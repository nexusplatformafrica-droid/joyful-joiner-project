import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { SubscribeModal } from "@/components/auth/SubscribeModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { DeviceLimitModal } from "@/components/auth/DeviceLimitModal";
import { PhoneRequiredModal } from "@/components/auth/PhoneRequiredModal";
import { useAuth } from "@/hooks/useAuth";
import { fdb, nowIso, watchTable } from "@/lib/fdb";
import {
  expireStaleSubscriptions,
  findUnfinishedTx,
  getTx,
  rememberedTx,
  syncTransaction,
} from "@/lib/payments";
import {
  isThisDevice,
  listDevices,
  pingDevice,
  thisDeviceRevoked,
  touchDevice,
  type DeviceRow,
} from "@/lib/devices";

type Ctx = {
  subscribed: boolean;
  /** True only when the account may actually play on this browser. */
  canPlay: boolean;
  deviceLimit: number;
  openSubscribe: () => void;
  /** Returns true when the user may proceed; otherwise asks to sign in / subscribe. */
  requireSubscription: () => boolean;
  refreshSubscription: () => void;
};

const SubscriptionContext = createContext<Ctx>({
  subscribed: false,
  canPlay: false,
  deviceLimit: 1,
  openSubscribe: () => {},
  requireSubscription: () => false,
  refreshSubscription: () => {},
});

const isLive = (s: { status?: unknown; expires_at?: unknown }) =>
  String(s.status ?? "").toLowerCase() === "active" &&
  (!s.expires_at || new Date(String(s.expires_at)).getTime() > Date.now());

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [deviceLimit, setDeviceLimit] = useState(1);
  const [others, setOthers] = useState<DeviceRow[]>([]);
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [tick, setTick] = useState(0);
  const busy = useRef(false);

  const refreshSubscription = useCallback(() => setTick((t) => t + 1), []);

  /* ---------- membership state (expiry is enforced on every read) ---------- */
  useEffect(() => {
    let alive = true;
    if (!user) {
      setSubscribed(false);
      setDeviceBlocked(false);
      setOthers([]);
      return;
    }
    let expiryTimer = 0;
    void (async () => {
      // Flip any past-due row to "expired" first so the DB and UI agree.
      await expireStaleSubscriptions(user.id).catch(() => 0);
      const { data } = await fdb.from("luo_subscriptions").select("*").eq("user_id", user.id);
      if (!alive) return;
      const live = data.filter(isLive);
      setSubscribed(live.length > 0);
      setDeviceLimit(
        live.reduce((max, s) => Math.max(max, Number(s.device_limit ?? 1) || 1), live.length ? 1 : 1),
      );

      // Re-check exactly when the furthest membership runs out, so access is
      // revoked mid-session instead of surviving until the next reload.
      const ends = live
        .map((s) => (s.expires_at ? new Date(String(s.expires_at)).getTime() : Infinity))
        .filter((t) => Number.isFinite(t)) as number[];
      if (ends.length) {
        const wait = Math.max(1000, Math.min(...ends) - Date.now() + 1000);
        if (wait < 2 ** 31 - 1) expiryTimer = window.setTimeout(() => setTick((t) => t + 1), wait);
      }
    })();
    void fdb.from("profiles").update({ last_seen: nowIso() }).eq("id", user.id);
    return () => {
      alive = false;
      if (expiryTimer) window.clearTimeout(expiryTimer);
    };
  }, [user, tick]);

  /* ---------- periodic safety net: catch expiry even without a timer ------- */
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [user]);

  /* ---------- instant activation: react the moment admin grants a plan ----- */
  useEffect(() => {
    if (!user) return;
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("luofilm:subscription-changed", bump);
    const stop = watchTable("luo_subscriptions", bump);
    return () => {
      window.removeEventListener("luofilm:subscription-changed", bump);
      stop();
    };
  }, [user]);

  /* ---------- device registry: register, enforce, obey remote sign-out ------ */
  useEffect(() => {
    if (!user) return;
    let alive = true;

    // Only revokes issued after this sign-in may sign this browser out; older
    // ones (e.g. the user signing this device out themselves) are cleared.
    const sessionStart = Date.now();

    const evaluate = async () => {
      try {
        if (await thisDeviceRevoked(user.id, sessionStart)) {
          toast.error("This account was opened on another device, so you were signed out here.");
          await signOut();
          return;
        }
        const rows = await listDevices(user.id);
        if (!alive) return;
        const mine = rows.find(isThisDevice);
        const rest = rows.filter((r) => !isThisDevice(r));

        // Always keep this browser registered so the list is honest.
        if (mine) await pingDevice(user.id);
        else await touchDevice(user.id);
        setOthers(rest);

        // Device limits only apply to paying members: an unsubscribed account
        // may sign in anywhere (it simply cannot play), so nobody is kicked out.
        if (!subscribed) {
          setDeviceBlocked(false);
          return;
        }

        // The plan's allowance goes to the devices that claimed it first; any
        // extra device is asked to sign one of the others out.
        const limit = Math.max(1, deviceLimit);
        if (!mine) {
          setDeviceBlocked(rest.length >= limit);
          return;
        }
        const order = [...rows].sort((a, b) =>
          String(a.created_at ?? a.last_seen ?? "").localeCompare(
            String(b.created_at ?? b.last_seen ?? ""),
          ),
        );
        setDeviceBlocked(!order.slice(0, limit).some(isThisDevice));
      } catch {
        /* the registry must never break playback */
      }
    };

    void evaluate();
    const id = window.setInterval(() => void evaluate(), 8000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [user, deviceLimit, subscribed, tick, signOut]);

  /** Serverless payment resume: finishes payments even after a refresh. */
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => {
      if (busy.current) return;
      busy.current = true;
      void (async () => {
        try {
          if ((await expireStaleSubscriptions(user.id)) > 0) refreshSubscription();
          const remembered = rememberedTx();
          let tx = remembered ? await getTx(remembered) : null;
          if (!tx || !["pending", "awaiting_scan"].includes(String(tx.status).toLowerCase()))
            tx = await findUnfinishedTx(user.id);
          if (tx) {
            const result = await syncTransaction(String(tx.id));
            if (result.status === "completed") {
              refreshSubscription();
              toast.success("Payment confirmed — your subscription is active.");
            }
          }
        } catch {
          /* keep trying quietly */
        } finally {
          busy.current = false;
        }
      })();
    }, 3000);
    return () => window.clearInterval(id);
  }, [user, refreshSubscription]);

  useEffect(() => {
    if (user && pending) {
      setPending(false);
      setOpen(true);
    }
  }, [user, pending]);

  const openSubscribe = useCallback(() => {
    if (!user) {
      setPending(true);
      setAuthOpen(true);
      return;
    }
    setOpen(true);
  }, [user]);

  const canPlay = subscribed && !deviceBlocked;

  const requireSubscription = useCallback(() => {
    if (subscribed && !deviceBlocked) return true;
    if (!deviceBlocked) openSubscribe();
    return false;
  }, [subscribed, deviceBlocked, openSubscribe]);

  const value = useMemo(
    () => ({
      subscribed,
      canPlay,
      deviceLimit,
      openSubscribe,
      requireSubscription,
      refreshSubscription,
    }),
    [subscribed, canPlay, deviceLimit, openSubscribe, requireSubscription, refreshSubscription],
  );

  const needsPhone = !!user && !!profile && !profile.phone;

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <SubscribeModal open={open} onOpenChange={setOpen} />
      <AuthModal
        open={authOpen}
        onOpenChange={(v) => {
          setAuthOpen(v);
          if (!v) setPending(false);
        }}
      />
      <PhoneRequiredModal open={needsPhone && !deviceBlocked} />
      <DeviceLimitModal
        open={deviceBlocked}
        limit={deviceLimit}
        others={others}
        onResolved={() => {
          setDeviceBlocked(false);
          refreshSubscription();
        }}
        onSignOut={() => void signOut()}
      />
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
