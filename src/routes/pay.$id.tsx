import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { getTx, startMobileMoney, syncTransaction } from "@/lib/payments";
import { formatMoney, isValidMsisdn } from "@/lib/relworx";
import type { Row } from "@/lib/fdb";

export const Route = createFileRoute("/pay/$id")({
  head: () => ({
    meta: [
      { title: "Complete your payment — LUOFILM.SITE" },
      { name: "description", content: "Finish your LUOFILM membership payment with MTN MoMo or Airtel Money." },
      { property: "og:title", content: "Complete your payment — LUOFILM.SITE" },
      {
        property: "og:description",
        content: "Finish your LUOFILM membership payment with MTN MoMo or Airtel Money.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayPage,
});

function PayPage() {
  const { id } = Route.useParams();
  const [tx, setTx] = useState<Row | null>(null);
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState<"idle" | "waiting" | "done" | "failed">("idle");
  const [status, setStatus] = useState("");
  const started = useRef(false);

  useEffect(() => {
    void getTx(id).then((row) => {
      setTx(row);
      if (!row) setStatus("This payment link is not valid.");
    });
  }, [id]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = window.setInterval(() => {
      void syncTransaction(id).then((r) => {
        if (r.status === "completed") {
          setPhase("done");
          setStatus("Payment confirmed. Your membership is active on all your devices.");
        } else if (r.status === "failed" || r.status === "expired") {
          setPhase("failed");
          setStatus(r.message);
        } else setStatus(r.message);
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [phase, id]);

  const send = async () => {
    if (!tx || started.current) return;
    if (!isValidMsisdn(phone)) {
      setStatus("Enter a valid MTN or Airtel number, e.g. 0770 123 456");
      return;
    }
    started.current = true;
    setPhase("waiting");
    setStatus("Sending the payment request to your phone…");
    try {
      await startMobileMoney(tx, phone);
      setStatus("Approve the prompt on your phone to finish.");
    } catch (err) {
      started.current = false;
      setPhase("failed");
      setStatus(err instanceof Error ? err.message : "Could not start the payment.");
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(160deg,oklch(0.98_0.02_20),oklch(0.97_0.03_320)_45%,oklch(0.98_0.03_80))] px-4 py-10 text-[oklch(0.28_0.03_320)]">
      <section className="w-full max-w-[420px] rounded-[28px] bg-white/70 p-6 shadow-2xl ring-1 ring-black/5 backdrop-blur">
        <h1 className="text-[20px] font-black tracking-tight">Complete your payment</h1>
        <p className="mt-1 text-[12px] opacity-65">LUOFILM.SITE membership</p>

        {tx ? (
          <>
            <div className="mt-4 rounded-2xl bg-[linear-gradient(120deg,oklch(0.88_0.07_75),oklch(0.82_0.1_65))] p-4">
              <p className="text-[11px] opacity-70">Plan</p>
              <p className="text-[17px] font-black leading-tight">{String(tx.plan_name ?? "Membership")}</p>
              <p className="mt-2 text-[24px] font-black leading-none">{formatMoney(Number(tx.amount))}</p>
            </div>

            {phase !== "done" && (
              <div className="mt-4">
                <label className="text-[11px] font-semibold opacity-70">Mobile money number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="0770 123 456"
                  disabled={phase === "waiting"}
                  className="mt-1 h-11 w-full rounded-2xl bg-white px-4 text-sm outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-[oklch(0.82_0.1_65)]"
                />
              </div>
            )}

            {status && (
              <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed opacity-80">
                {phase === "waiting" && <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />}
                {phase === "done" && <ShieldCheck className="mt-0.5 size-4 shrink-0" />}
                {status}
              </p>
            )}

            {phase !== "done" && (
              <button
                type="button"
                onClick={() => void send()}
                disabled={phase === "waiting"}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(100deg,oklch(0.97_0.05_95),oklch(0.88_0.11_82))] text-[15px] font-bold text-[oklch(0.3_0.06_60)] shadow-[0_12px_28px_-14px_oklch(0.8_0.12_75)] transition hover:brightness-105 disabled:opacity-60"
              >
                <Smartphone className="size-4" />
                {phase === "waiting" ? "Waiting for approval…" : "Send payment request"}
              </button>
            )}

            <a
              href="/"
              className="mt-3 block text-center text-[11px] font-semibold opacity-60 hover:opacity-100"
            >
              Back to LUOFILM
            </a>
          </>
        ) : (
          <p className="mt-6 text-[13px] opacity-70">{status || "Loading payment…"}</p>
        )}
      </section>
    </main>
  );
}
