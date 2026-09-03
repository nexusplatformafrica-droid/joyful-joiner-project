/**
 * Google One Tap sign-in, wired into the same Firebase auth session that the
 * "Continue with Google" popup uses. If no OAuth web client ID is configured
 * the whole thing quietly no-ops so sign-in keeps working as before.
 */
import { GoogleAuthProvider, browserLocalPersistence, setPersistence, signInWithCredential } from "firebase/auth";
import { getFbAuth, GOOGLE_CLIENT_ID } from "./firebase";
import { ensureProfile } from "./db";

type GsiCredentialResponse = { credential?: string };

type Gsi = {
  accounts: {
    id: {
      initialize: (o: Record<string, unknown>) => void;
      prompt: (cb?: (n: unknown) => void) => void;
      cancel: () => void;
      renderButton?: (el: HTMLElement, o: Record<string, unknown>) => void;
      disableAutoSelect: () => void;
    };
  };
};

declare global {
  interface Window {
    google?: Gsi;
  }
}

let scriptPromise: Promise<Gsi | null> | null = null;

function loadGsi(): Promise<Gsi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<Gsi | null>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    const done = () => resolve(window.google ?? null);
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => resolve(null));
      if (window.google?.accounts?.id) done();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = done;
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Signs the One Tap ID token into Firebase, exactly like the popup flow. */
export async function signInWithGoogleIdToken(idToken: string) {
  const auth = getFbAuth();
  await setPersistence(auth, browserLocalPersistence).catch(() => {});
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  await ensureProfile(cred.user);
  return cred;
}

export function oneTapAvailable() {
  return typeof window !== "undefined" && !!GOOGLE_CLIENT_ID;
}

/**
 * Shows the One Tap prompt. Returns a cleanup function.
 * Safe to call repeatedly — Google dedupes and we cancel on unmount.
 */
export async function startGoogleOneTap(opts: {
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
  /** One Tap wording: "signin" | "signup" | "use". */
  context?: "signin" | "signup" | "use";
}): Promise<() => void> {

  if (!oneTapAvailable()) return () => {};
  const gsi = await loadGsi();
  if (!gsi?.accounts?.id) return () => {};
  try {
    gsi.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      // Returning visitors are signed straight back in without a click; new
      // visitors get the native "Continue as <name>" One Tap card.
      auto_select: true,
      cancel_on_tap_outside: false,
      context: opts.context ?? "signin",
      itp_support: true,
      use_fedcm_for_prompt: true,
      callback: (res: GsiCredentialResponse) => {
        if (!res?.credential) return;
        void signInWithGoogleIdToken(res.credential)
          .then(() => opts.onSuccess?.())
          .catch((err) => opts.onError?.(err));
      },
    });
    gsi.accounts.id.prompt();

  } catch (err) {
    opts.onError?.(err);
    return () => {};
  }
  return () => {
    try {
      gsi.accounts.id.cancel();
    } catch {
      /* ignore */
    }
  };
}

export function disableGoogleAutoSelect() {
  try {
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {
    /* ignore */
  }
}
