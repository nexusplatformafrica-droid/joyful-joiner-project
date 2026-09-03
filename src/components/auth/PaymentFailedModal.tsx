import { AlertTriangle, RefreshCw, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type FailureKind = "low_balance" | "generic";

/** Turns a raw gateway code into copy a real person understands. */
export function explainFailure(raw: string): { kind: FailureKind; title: string; body: string } {
  const code = (raw ?? "").toUpperCase();
  if (/LOW_BALANCE|PAYEE_LIMIT|NOT_ALLOWED|INSUFFICIENT/.test(code)) {
    return {
      kind: "low_balance",
      title: "You don't have enough money",
      body:
        "There isn't enough money on your Mobile Money account to complete this payment. Load your MTN MoMo or Airtel Money wallet and try again — your plan is still waiting for you.",
    };
  }
  return {
    kind: "generic",
    title: "Payment didn't go through",
    body: raw || "The payment was not completed. You can try again in a moment.",
  };
}

export function PaymentFailedModal({
  open,
  onOpenChange,
  message,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  message: string;
  onRetry: () => void;
}) {
  const info = explainFailure(message);
  const low = info.kind === "low_balance";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px] overflow-hidden rounded-[28px] border-0 bg-[linear-gradient(165deg,oklch(0.99_0.01_60),oklch(0.97_0.03_30)_55%,oklch(0.98_0.03_350))] p-0 text-[oklch(0.28_0.03_320)] shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{info.title}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-7 text-center">
          <span className="relative mx-auto grid size-16 place-items-center rounded-full bg-[linear-gradient(150deg,oklch(0.93_0.09_60),oklch(0.86_0.13_35))] text-[oklch(0.32_0.08_40)] shadow-[0_16px_36px_-18px_oklch(0.7_0.15_40)]">
            {low ? <Wallet className="size-7" /> : <AlertTriangle className="size-7" />}
            <span className="absolute inset-0 animate-ping rounded-full bg-[oklch(0.86_0.13_35)]/30" />
          </span>

          <p className="mt-4 text-[19px] font-black leading-tight">{info.title}</p>
          <p className="mx-auto mt-2 max-w-[19rem] text-[13px] leading-relaxed opacity-70">
            {info.body}
          </p>

          {low && (
            <div className="mt-4 rounded-2xl bg-white/70 p-3 text-left ring-1 ring-black/5">
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-60">
                How to fix it
              </p>
              <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed opacity-80">
                <li>· Deposit money on your MTN MoMo or Airtel Money line.</li>
                <li>· Check your daily transaction limit isn't reached.</li>
                <li>· Then tap Try again below.</li>
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={onRetry}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(100deg,oklch(0.97_0.05_95),oklch(0.88_0.11_82))] text-[15px] font-bold text-[oklch(0.3_0.06_60)] shadow-[0_12px_28px_-14px_oklch(0.8_0.12_75)] transition hover:brightness-105"
          >
            <RefreshCw className="size-4" />
            Try again
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-2 h-9 w-full rounded-full text-[12px] font-semibold opacity-60 transition hover:opacity-100"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
