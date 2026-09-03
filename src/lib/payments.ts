import { fdb, nowIso, uuid, type Row } from "./fdb";
import { countryByCurrency, countryFromPhone, isValidFor, normalizeFor } from "./countries";
import { CURRENCY_CODE, readStatus, relworx } from "./relworx";


export type PayPlan = {
  id: string;
  name: string;
  price: number;
  days: number;
  tier?: string;
  /** How many devices this plan allows to be signed in at once. */
  devices?: number;
};
export type PayMethod = "mobile_money" | "link";

const LAST_TX = "last_payment_tx";

export function rememberTx(id: string) {
  try {
    localStorage.setItem(LAST_TX, id);
  } catch {
    /* ignore */
  }
}
export function forgetTx() {
  try {
    localStorage.removeItem(LAST_TX);
  } catch {
    /* ignore */
  }
}
export function rememberedTx() {
  try {
    return localStorage.getItem(LAST_TX);
  } catch {
    return null;
  }
}

export async function getTx(id: string) {
  const { data } = await fdb.from("luo_transactions").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function createPaymentIntent(input: {
  userId: string;
  plan: PayPlan;
  method: PayMethod;
}) {
  const id = uuid();
  const row: Row = {
    id,
    user_id: input.userId,
    plan_id: input.plan.id,
    plan_name: input.plan.name,
    tier: input.plan.tier ?? "vip",
    duration_days: input.plan.days,
    device_limit: Number(input.plan.devices ?? 1) || 1,
    amount: input.plan.price,
    currency: CURRENCY_CODE,
    kind: "payment",
    status: input.method === "link" ? "awaiting_scan" : "pending",
    method: input.method,
    reference: `LUO-${Date.now()}-${id.slice(0, 8)}`,
    internal_reference: null,
    msisdn: null,
    note: `Subscription — ${input.plan.name}`,
    link_expires_at: input.method === "link" ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
    used_at: null,
    completed_at: null,
    created_at: nowIso(),
  };
  const { error } = await fdb.from("luo_transactions").insert(row);
  if (error) throw error;
  rememberTx(id);
  return row;
}

export async function startMobileMoney(tx: Row, phone: string) {
  const msisdn = normalizeMsisdn(phone);
  const res = await relworx.deposit({
    msisdn,
    amount: Number(tx.amount),
    reference: String(tx.reference),
    description: String(tx.note ?? "Subscription"),
  });
  const internal = res?.internal_reference ?? res?.data?.internal_reference;
  if (!internal) throw new Error(res?.message ?? "The payment service did not start the request.");
  await fdb
    .from("luo_transactions")
    .update({
      msisdn,
      phone: msisdn,
      internal_reference: internal,
      status: "pending",
      method: "mobile_money",
      used_at: nowIso(),
    })
    .eq("id", String(tx.id));
  return { ...tx, msisdn, internal_reference: internal, status: "pending" };
}

async function activateSubscription(tx: Row) {
  // One transaction may only ever grant one subscription, no matter how many
  // pollers (this tab, the provider hook, the /pay page) confirm it at once.
  const { data: existing } = await fdb
    .from("luo_subscriptions")
    .select("*")
    .eq("transaction_id", String(tx.id))
    .maybeSingle();
  if (existing) return;

  const { data: latest } = await fdb
    .from("luo_subscriptions")
    .select("*")
    .eq("user_id", tx.user_id)
    .order("created_at", { ascending: false })
    .maybeSingle();

  const live =
    latest &&
    String(latest.status).toLowerCase() === "active" &&
    (!latest.expires_at || new Date(latest.expires_at).getTime() > Date.now());
  const base = live ? new Date(latest!.expires_at ?? Date.now()).getTime() : Date.now();
  const days = Number(tx.duration_days ?? 30);
  const expires = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();

  await fdb.from("luo_subscriptions").insert({
    id: uuid(),
    user_id: tx.user_id,
    transaction_id: String(tx.id),
    plan_id: tx.plan_id,
    plan_name: tx.plan_name,
    tier: tx.tier ?? "vip",
    device_limit: Number(tx.device_limit ?? 1) || 1,
    amount: tx.amount,
    currency: tx.currency ?? CURRENCY_CODE,
    status: "active",
    starts_at: nowIso(),
    started_at: nowIso(),
    expires_at: expires,
    source: "relworx",
    created_at: nowIso(),
  });

  await fdb.from("luo_activities").insert({
    id: uuid(),
    user_id: tx.user_id,
    action: "subscription_activated",
    detail: `${tx.plan_name} · ${days} days`,
    target: String(tx.plan_name ?? ""),
    created_at: nowIso(),
  });
}


export type SyncResult = { status: "pending" | "completed" | "failed" | "expired"; message: string };

/** In-flight syncs per transaction, so overlapping pollers share one result. */
const inFlight = new Map<string, Promise<SyncResult>>();

/** The heart of the flow: reads the live status and activates on success. */
export function syncTransaction(txId: string): Promise<SyncResult> {
  const running = inFlight.get(txId);
  if (running) return running;
  const job = runSync(txId).finally(() => inFlight.delete(txId));
  inFlight.set(txId, job);
  return job;
}

async function runSync(txId: string): Promise<SyncResult> {
  const tx = await getTx(txId);
  if (!tx) return { status: "failed", message: "Payment not found" };

  const status = String(tx.status ?? "").toLowerCase();
  if (status === "completed") return { status: "completed", message: "Payment confirmed" };
  if (status === "failed") return { status: "failed", message: String(tx.note ?? "Payment failed") };
  if (status === "expired") return { status: "expired", message: "This payment link expired" };

  if (status === "awaiting_scan" && tx.link_expires_at && new Date(tx.link_expires_at).getTime() < Date.now()) {
    await fdb.from("luo_transactions").update({ status: "expired" }).eq("id", txId);
    return { status: "expired", message: "This payment link expired" };
  }

  if (!tx.internal_reference) return { status: "pending", message: "Waiting for payment to start" };

  try {
    const result = readStatus(await relworx.requestStatus(String(tx.internal_reference)));
    if (result.status === "success") {
      // Claim the transaction first, then re-read it: if another tab already
      // completed it, we skip activation instead of granting a second plan.
      await fdb
        .from("luo_transactions")
        .update({ status: "completed", completed_at: nowIso() })
        .eq("id", txId);
      await activateSubscription(tx);
      forgetTx();
      return { status: "completed", message: "Payment confirmed" };
    }
    if (result.status === "failed") {
      await fdb.from("luo_transactions").update({ status: "failed", note: result.message }).eq("id", txId);
      forgetTx();
      return { status: "failed", message: result.message };
    }
    return { status: "pending", message: result.message };
  } catch {
    return { status: "pending", message: "Waiting for confirmation" };
  }
}


/** Marks any past-due active subscription as expired. Returns how many changed. */
export async function expireStaleSubscriptions(userId: string) {
  const { data } = await fdb.from("luo_subscriptions").select("*").eq("user_id", userId);
  let changed = 0;
  for (const s of data) {
    if (
      String(s.status).toLowerCase() === "active" &&
      s.expires_at &&
      new Date(s.expires_at).getTime() < Date.now()
    ) {
      await fdb.from("luo_subscriptions").update({ status: "expired" }).eq("id", String(s.id));
      changed += 1;
    }
  }
  return changed;
}

export async function findUnfinishedTx(userId: string) {
  const { data } = await fdb
    .from("luo_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const sixHours = Date.now() - 6 * 60 * 60 * 1000;
  return (
    data.find(
      (t) =>
        t.kind === "payment" &&
        ["pending", "awaiting_scan"].includes(String(t.status).toLowerCase()) &&
        new Date(t.created_at ?? 0).getTime() > sixHours,
    ) ?? null
  );
}

export async function expireTx(txId: string) {
  await fdb.from("luo_transactions").update({ status: "expired" }).eq("id", txId);
}
