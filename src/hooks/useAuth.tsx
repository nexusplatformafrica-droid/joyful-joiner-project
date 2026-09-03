import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFbAuth, initAnalytics } from "@/lib/firebase";
import { db, ensureProfile, hasAdminRole, isAdminCredential, type SessionUser } from "@/lib/db";
import { fdb } from "@/lib/fdb";
import { disableGoogleAutoSelect, startGoogleOneTap } from "@/lib/google-one-tap";

type Profile = Record<string, unknown> & { id?: string; email?: string | null; phone?: string | null };

type AuthState = {
  user: SessionUser | null;
  session: { user: SessionUser } | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refresh: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void initAnalytics();
    const stop = onAuthStateChanged(getFbAuth(), (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setUser({ id: fbUser.uid, email: fbUser.email, name: fbUser.displayName });
      // Credential check first, so the admin gets in even if Firestore hiccups.
      setIsAdmin(isAdminCredential(fbUser.email));
      setLoading(false);
      void (async () => {
        await ensureProfile(fbUser);
        const { data } = await fdb.from("profiles").select("*").eq("id", fbUser.uid).maybeSingle();
        setProfile(data as Profile | null);
        const admin =
          isAdminCredential(fbUser.email, (data?.phone as string | undefined) ?? null) ||
          (await hasAdminRole(fbUser.uid).catch(() => false));
        setIsAdmin(admin);
      })().catch(() => {});
    });
    return stop;
  }, [tick]);

  // Presence heartbeat so the admin dashboard's "online now" count is real.
  useEffect(() => {
    if (!user) return;
    const ping = () => {
      void (async () => {
        await fdb.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
      })().catch(() => {});
    };
    ping();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") ping();
    }, 60_000);
    const onVisible = () => document.visibilityState === "visible" && ping();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  // Site-wide Google One Tap prompt for signed-out visitors.
  useEffect(() => {
    if (loading || user) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      void startGoogleOneTap({
        context: "use",
        onSuccess: () => setTick((t) => t + 1),
      }).then((fn) =>
        cancelled ? fn() : (stop = fn),
      );
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stop?.();
    };
  }, [loading, user]);


  const signOut = useCallback(async () => {
    disableGoogleAutoSelect();
    await db.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      session: user ? { user } : null,
      profile,
      isAdmin,
      loading,
      refresh: () => setTick((t) => t + 1),
      signOut,
    }),
    [user, profile, isAdmin, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useIsAdmin() {
  const { isAdmin, loading, user } = useAuth();
  return { isAdmin, checking: loading, user };
}
