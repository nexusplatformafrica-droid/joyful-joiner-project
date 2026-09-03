import { Crown, Lock } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Overlay shown on top of the player when the viewer has no active membership.
 * Blocks playback until they subscribe.
 */
export function SubscribeGate({ title }: { title?: string }) {
  const { openSubscribe } = useSubscription();

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/80 px-6 text-center backdrop-blur-sm">
      <div className="max-w-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-vip/20 text-vip">
          <Lock className="size-5" />
        </span>
        <p className="mt-3 text-base font-bold text-white">Membership required</p>
        <p className="mt-1 text-[13px] text-white/70">
          Subscribe to watch and download {title ? `“${title}”` : "this title"} in full quality.
        </p>
        <button
          type="button"
          onClick={openSubscribe}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(100deg,oklch(0.97_0.05_95),oklch(0.88_0.11_82))] px-6 text-[14px] font-bold text-[oklch(0.3_0.06_60)] shadow-[0_12px_28px_-14px_oklch(0.8_0.12_75)] transition hover:brightness-105"
        >
          <Crown className="size-4" />
          Subscribe to watch
        </button>
      </div>
    </div>
  );
}
