import { useState } from "react";
import { toast } from "sonner";
import { Laptop, LogOut, MonitorSmartphone, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { revokeDevice, type DeviceRow } from "@/lib/devices";

/**
 * Shown when the plan's device allowance is already used up.
 * Signing out another device really works: that browser polls its own row and
 * signs itself out as soon as it is revoked.
 */
export function DeviceLimitModal({
  open,
  limit,
  others,
  onResolved,
  onSignOut,
}: {
  open: boolean;
  limit: number;
  others: DeviceRow[];
  onResolved: () => void;
  onSignOut: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const kick = async (row: DeviceRow) => {
    setBusy(row.id);
    try {
      await revokeDevice(row.id);
      toast.success("That device was signed out. You're good to watch here.");
      onResolved();
    } catch {
      toast.error("Could not sign that device out. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        hideCloseButton
        className="max-w-[420px] overflow-hidden rounded-[28px] border-0 bg-[linear-gradient(165deg,oklch(0.99_0.01_300),oklch(0.97_0.03_320)_55%,oklch(0.98_0.02_60))] p-0 text-[oklch(0.28_0.03_320)] shadow-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Device limit reached</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-7">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(150deg,oklch(0.92_0.07_320),oklch(0.86_0.12_300))] text-white shadow-[0_14px_30px_-16px_oklch(0.7_0.15_300)]">
              <ShieldAlert className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[18px] font-black leading-tight">Device limit reached</p>
              <p className="mt-1 text-[12.5px] leading-relaxed opacity-70">
                Your plan allows {limit} {limit === 1 ? "device" : "devices"} and it is already in
                use. Sign out one of the devices below to keep watching on this one.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {others.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-black/5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black/5">
                  {/Windows|Mac|Linux/i.test(row.label ?? "") ? (
                    <Laptop className="size-4" />
                  ) : (
                    <MonitorSmartphone className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{row.label || "Device"}</p>
                  <p className="text-[11px] opacity-60">
                    Last active{" "}
                    {row.last_seen ? new Date(row.last_seen).toLocaleString() : "recently"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => void kick(row)}
                  className="h-9 shrink-0 rounded-full bg-[linear-gradient(100deg,oklch(0.97_0.05_95),oklch(0.88_0.11_82))] px-3 text-[12px] font-bold text-[oklch(0.3_0.06_60)] shadow-[0_10px_22px_-14px_oklch(0.8_0.12_75)] transition hover:brightness-105 disabled:opacity-60"
                >
                  {busy === row.id ? "Signing out…" : "Sign out"}
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/70 text-[13px] font-semibold ring-1 ring-black/5 transition hover:bg-white"
          >
            <LogOut className="size-4" />
            Sign out of this device instead
          </button>
          <p className="mt-3 text-center text-[10.5px] opacity-55">
            Need more devices? Upgrade to a higher plan any time.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
