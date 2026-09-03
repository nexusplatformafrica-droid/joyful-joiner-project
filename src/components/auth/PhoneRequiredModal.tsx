import { useState } from "react";
import { toast } from "sonner";
import { Phone, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fdb, nowIso } from "@/lib/fdb";
import { digitsOnly } from "@/lib/firebase";
import { isValidMsisdn, normalizeMsisdn } from "@/lib/relworx";
import { useAuth } from "@/hooks/useAuth";

/**
 * Every account must carry a mobile money number — payments and device
 * recovery depend on it, so this dialog cannot be dismissed or skipped.
 */
export function PhoneRequiredModal({ open }: { open: boolean }) {
  const { user, refresh, signOut } = useAuth();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!isValidMsisdn(phone)) {
      toast.error("Enter a valid MTN or Airtel number, e.g. 0770 123 456");
      return;
    }
    setBusy(true);
    try {
      const normalized = normalizeMsisdn(phone);
      await fdb
        .from("profiles")
        .update({ phone: digitsOnly(phone), msisdn: normalized, updated_at: nowIso() })
        .eq("id", user.id);
      toast.success("Phone number saved.");
      refresh();
    } catch {
      toast.error("Could not save your number. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        hideCloseButton
        className="max-w-[380px] overflow-hidden rounded-[28px] border-0 bg-[linear-gradient(165deg,oklch(0.99_0.01_60),oklch(0.97_0.03_320)_55%,oklch(0.98_0.02_80))] p-0 text-[oklch(0.28_0.03_320)] shadow-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Add your phone number</DialogTitle>
        </DialogHeader>

        <form onSubmit={save} className="px-6 pb-6 pt-7">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[linear-gradient(150deg,oklch(0.94_0.07_150),oklch(0.86_0.12_170))] text-white shadow-[0_14px_30px_-16px_oklch(0.7_0.14_165)]">
            <Phone className="size-6" />
          </span>
          <p className="mt-4 text-center text-[18px] font-black leading-tight">
            One last step
          </p>
          <p className="mx-auto mt-1 max-w-[18rem] text-center text-[12.5px] leading-relaxed opacity-70">
            Add the mobile money number for this account. We use it for payments and to keep your
            membership safe.
          </p>

          <input
            autoFocus
            required
            inputMode="tel"
            placeholder="0770 123 456"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-4 h-12 w-full rounded-2xl bg-white/80 px-4 text-center text-[15px] font-semibold tracking-wide outline-none ring-1 ring-black/5 transition placeholder:font-normal placeholder:opacity-40 focus:bg-white focus:ring-2 focus:ring-[oklch(0.82_0.1_65)]"
          />

          <button
            type="submit"
            disabled={busy}
            className="mt-4 h-12 w-full rounded-full bg-[linear-gradient(100deg,oklch(0.97_0.05_95),oklch(0.88_0.11_82))] text-[15px] font-bold text-[oklch(0.3_0.06_60)] shadow-[0_12px_28px_-14px_oklch(0.8_0.12_75)] transition hover:brightness-105 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save and continue"}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[10.5px] opacity-55">
            <ShieldCheck className="size-3" />
            Your number is never shown to other viewers.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-1 h-8 w-full rounded-full text-[11px] font-semibold opacity-50 transition hover:opacity-90"
          >
            Sign out
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
