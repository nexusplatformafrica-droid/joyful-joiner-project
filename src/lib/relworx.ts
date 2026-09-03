import { cachedSetting } from "./app-settings";

export type PaymentSettings = { backend_url?: string };

export const DEFAULT_PAYMENT_BACKEND = "https://function-bun-production-038e6.up.railway.app";

export function paymentBackend() {
  const saved = cachedSetting<PaymentSettings>("payment", {});
  return (saved.backend_url || DEFAULT_PAYMENT_BACKEND).trim().replace(/\/+$/, "");
}

export const CURRENCY_CODE = "UGX";
export const CURRENCY_LABEL = "UG SHS";
export const formatMoney = (n: number) =>
  `${CURRENCY_LABEL} ${Number(n || 0).toLocaleString("en-UG", { maximumFractionDigits: 0 })}`;

export function normalizeMsisdn(input: string) {
  const d = (input ?? "").replace(/[^0-9]/g, "");
  if (d.startsWith("256")) return `+${d}`;
  if (d.startsWith("0")) return `+256${d.slice(1)}`;
  if (d.length === 9) return `+256${d}`;
  return `+${d}`;
}

export const isValidMsisdn = (v: string) => /^\+256[37]\d{8}$/.test(normalizeMsisdn(v));

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${paymentBackend()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { message: text };
  }
  if (!res.ok) {
    const p = payload as { message?: string; error?: string };
    throw new Error(p.message ?? p.error ?? `Payment service error (${res.status})`);
  }
  return payload as T;
}

export type DepositInput = {
  msisdn: string;
  amount: number;
  currency?: string;
  reference: string;
  description?: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export const relworx = {
  health: () => call<any>("/health"),
  validatePhone: (msisdn: string) =>
    call<any>("/api/validate-phone", { method: "POST", body: JSON.stringify({ msisdn }) }),
  deposit: (input: DepositInput) =>
    call<any>("/api/deposit", {
      method: "POST",
      body: JSON.stringify({ currency: CURRENCY_CODE, ...input }),
    }),
  withdraw: (input: DepositInput) =>
    call<any>("/api/withdraw", {
      method: "POST",
      body: JSON.stringify({ currency: CURRENCY_CODE, ...input }),
    }),
  balance: (currency = CURRENCY_CODE) =>
    call<any>(`/api/wallet/balance?currency=${encodeURIComponent(currency)}`),
  requestStatus: (internalReference: string) =>
    call<any>(`/api/request-status?internal_reference=${encodeURIComponent(internalReference)}`),
  transactions: () => call<any>("/api/transactions"),
};

const SUCCESS = /^(success|successful|completed|complete|paid)$/i;
const FAILED = /^(failed|failure|cancelled|canceled|declined|error|rejected|expired)$/i;

export function readStatus(payload: any): {
  status: "pending" | "success" | "failed";
  message: string;
} {
  const raw =
    payload?.status ??
    payload?.data?.status ??
    payload?.request?.status ??
    payload?.transaction?.status ??
    payload?.request_status;
  const message = String(
    payload?.message ?? payload?.data?.message ?? payload?.request?.message ?? "",
  );
  if (typeof raw === "string") {
    if (SUCCESS.test(raw)) return { status: "success", message: message || "Payment received" };
    if (FAILED.test(raw)) return { status: "failed", message: message || "Payment failed" };
  }
  if (raw == null && payload?.success === false)
    return { status: "failed", message: message || "Payment failed" };
  return { status: "pending", message: message || "Waiting for confirmation" };
}

export type RelworxTx = {
  id: string;
  reference: string;
  internal_reference: string | null;
  msisdn: string | null;
  amount: number;
  currency: string;
  status: string;
  kind: string;
  created_at: string;
};

const pickArray = (payload: any): any[] => {
  for (const v of [
    payload?.transactions,
    payload?.data?.transactions,
    payload?.data,
    payload?.results,
    payload,
  ])
    if (Array.isArray(v)) return v;
  return [];
};

/** Transactions straight from the Relworx wallet (the money source of truth). */
export async function listRelworxTransactions(): Promise<RelworxTx[]> {
  const rows = pickArray(await relworx.transactions());
  return rows.map((r, i) => {
    const raw = String(r?.status ?? r?.request_status ?? "pending");
    const status = SUCCESS.test(raw) ? "success" : FAILED.test(raw) ? "failed" : raw.toLowerCase();
    return {
      id: String(r?.id ?? r?.internal_reference ?? r?.reference ?? `rw-${i}`),
      reference: String(r?.reference ?? r?.customer_reference ?? "—"),
      internal_reference: r?.internal_reference ? String(r.internal_reference) : null,
      msisdn: r?.msisdn ? String(r.msisdn) : (r?.phone ? String(r.phone) : null),
      amount: Number(r?.amount ?? r?.value ?? 0) || 0,
      currency: String(r?.currency ?? CURRENCY_CODE),
      status,
      kind: String(r?.type ?? r?.kind ?? (Number(r?.amount) < 0 ? "withdraw" : "payment")),
      created_at: String(r?.created_at ?? r?.date ?? r?.updated_at ?? new Date().toISOString()),
    };
  });
}

export type WithdrawResult = {
  reference: string;
  internal_reference: string | null;
  status: "pending" | "success" | "failed";
  message: string;
};

/**
 * Sends money out of the Relworx wallet to a mobile money number and waits a
 * short while for the provider to confirm it, so the admin sees a real result
 * instead of a "request created" placeholder.
 */
export async function sendWithdrawal(input: {
  phone: string;
  amount: number;
  description?: string;
}): Promise<WithdrawResult> {
  const msisdn = normalizeMsisdn(input.phone);
  if (!isValidMsisdn(msisdn)) throw new Error("Enter a valid Ugandan MTN or Airtel number");
  const amount = Math.round(Number(input.amount));
  if (!amount || amount <= 0) throw new Error("Enter a valid amount");

  const reference = `LUO-WD-${Date.now()}`;
  const res = await relworx.withdraw({
    msisdn,
    amount,
    reference,
    description: input.description || "LUOFILM payout",
  });

  const internal = res?.internal_reference ?? res?.data?.internal_reference ?? null;
  if (!internal) {
    const first = readStatus(res);
    if (first.status === "failed") throw new Error(first.message || "Relworx rejected the payout");
    return { reference, internal_reference: null, status: first.status, message: first.message };
  }

  // Poll for up to ~30s; anything still pending stays pending in the ledger.
  let last = readStatus(res);
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      last = readStatus(await relworx.requestStatus(String(internal)));
    } catch {
      continue;
    }
    if (last.status !== "pending") break;
  }
  return {
    reference,
    internal_reference: String(internal),
    status: last.status,
    message:
      last.message ||
      (last.status === "success" ? "Payout sent" : "Payout is still being processed"),
  };
}

/** Live Relworx wallet balance in UGX; null when the service is unreachable. */
export async function walletBalance(currency = CURRENCY_CODE): Promise<number | null> {
  try {
    const res = await relworx.balance(currency);
    const raw =
      res?.balance ?? res?.data?.balance ?? res?.wallet?.balance ?? res?.available_balance;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
