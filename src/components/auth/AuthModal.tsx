import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authMessage, signInWithGoogle, signInWithIdentifier, signUpWithIdentifier } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { isValidMsisdn } from "@/lib/relworx";
import { startGoogleOneTap } from "@/lib/google-one-tap";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const { refresh, user } = useAuth();

  // Google One Tap: offered right inside the modal, same Firebase session.
  useEffect(() => {
    if (!open || user) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void startGoogleOneTap({
      context: "use",
      onSuccess: () => {
        toast.success("Signed in with Google");
        refresh();
        onOpenChange(false);
      },
      onError: (err) => toast.error(authMessage(err)),
    }).then((fn) => (cancelled ? fn() : (stop = fn)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [open, user, refresh, onOpenChange]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!isValidMsisdn(phone)) {
          toast.error("Enter the mobile money number for this account, e.g. 0770 123 456");
          return;
        }
        await signUpWithIdentifier({ identifier, password, name, phone });
        toast.success("Account created. You're signed in.");
      } else {
        await signInWithIdentifier(identifier, password);
        toast.success("Welcome back!");
      }
      refresh();
      onOpenChange(false);
    } catch (err) {
      toast.error(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in with Google");
      refresh();
      onOpenChange(false);
    } catch (err) {
      toast.error(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const field =
    "h-11 w-full rounded-2xl bg-white/70 px-4 text-sm outline-none ring-1 ring-black/5 transition placeholder:opacity-50 focus:bg-white focus:ring-2 focus:ring-[oklch(0.82_0.1_65)]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] overflow-hidden border-0 bg-[linear-gradient(165deg,oklch(0.98_0.02_20),oklch(0.97_0.03_320)_55%,oklch(0.98_0.03_80))] p-6 text-[oklch(0.28_0.03_320)] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-[20px] font-bold tracking-tight">
            {mode === "signin" ? "Sign in to LUOFILM" : "Create your account"}
          </DialogTitle>
        </DialogHeader>

        <button
          type="button"
          onClick={google}
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/80 text-sm font-semibold shadow-[0_8px_22px_-16px_rgba(0,0,0,0.8)] ring-1 ring-black/5 transition hover:bg-white disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1A6.2 6.2 0 1 1 12 5.8c1.8 0 3 .8 3.7 1.4l2.5-2.4A9.8 9.8 0 1 0 12 21.8c5.6 0 9.4-3.9 9.4-9.5 0-.6-.06-1.1-.16-1.6H12Z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-[11px] uppercase opacity-60">
          <span className="h-px flex-1 bg-black/10" /> or <span className="h-px flex-1 bg-black/10" />
        </div>

        <form onSubmit={submit} className="space-y-2">
          {mode === "signup" && (
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          )}
          <input
            required
            placeholder="Phone number or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={field}
          />
          {mode === "signup" && (
            <input
              required
              inputMode="tel"
              placeholder="Mobile money number (required)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={field}
            />
          )}
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-full bg-[linear-gradient(100deg,oklch(0.97_0.05_95),oklch(0.88_0.11_82))] text-sm font-bold text-[oklch(0.3_0.06_60)] shadow-[0_12px_28px_-14px_oklch(0.8_0.12_75)] transition hover:brightness-105 disabled:opacity-50"
          >
            {mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-center text-xs opacity-65 transition hover:opacity-100"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
