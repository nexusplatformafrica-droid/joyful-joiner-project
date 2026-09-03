/**
 * The single data entry point for the whole site — Firestore only, no server.
 * It keeps the familiar `.from()` / `.auth` surface so screens read the same
 * way they always did, while every byte now goes straight to Firebase.
 */
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { fdb, nowIso, uuid } from "./fdb";
import { ADMIN_EMAIL, ADMIN_PHONE, digitsOnly, getFbAuth, phoneToAuthEmail } from "./firebase";

export type SessionUser = { id: string; email: string | null; name?: string | null };

const toSessionUser = (u: User | null): SessionUser | null =>
  u ? { id: u.uid, email: u.email, name: u.displayName } : null;

/** Admin identity is decided from the credential first, so admins never lock out. */
export function isAdminCredential(email?: string | null, phone?: string | null) {
  const e = (email ?? "").toLowerCase();
  if (e && (e === ADMIN_EMAIL.toLowerCase() || e === phoneToAuthEmail(ADMIN_PHONE))) return true;
  return !!phone && digitsOnly(phone) === digitsOnly(ADMIN_PHONE);
}

/** Creates the profile on first sign-in and refreshes `last_seen` afterwards. */
export async function ensureProfile(user: User, extra?: { name?: string; phone?: string }) {
  try {
    const { data: existing } = await fdb.from("profiles").select("*").eq("id", user.uid).maybeSingle();
    const base = {
      id: user.uid,
      email: user.email ?? null,
      last_seen: nowIso(),
      ...(extra?.name || user.displayName
        ? { name: extra?.name ?? user.displayName, display_name: extra?.name ?? user.displayName }
        : {}),
      ...(extra?.phone ? { phone: extra.phone } : {}),
      ...(user.photoURL ? { avatar_url: user.photoURL } : {}),
    };
    if (existing) await fdb.from("profiles").update(base).eq("id", user.uid);
    else await fdb.from("profiles").insert({ ...base, created_at: nowIso() });
    await ensureRole(user.uid, user.email, extra?.phone ?? (existing?.phone as string | undefined));
  } catch {
    /* profile writes must never block sign-in */
  }
}

export async function ensureRole(uid: string, email?: string | null, phone?: string | null) {
  const role = isAdminCredential(email, phone) ? "admin" : "user";
  const { data } = await fdb.from("user_roles").select("*").eq("user_id", uid).maybeSingle();
  if (!data) await fdb.from("user_roles").insert({ id: uuid(), user_id: uid, role, created_at: nowIso() });
  else if (data.role !== role && role === "admin")
    await fdb.from("user_roles").update({ role }).eq("id", String(data.id));
  return role;
}

export async function hasAdminRole(uid: string) {
  const { data } = await fdb.from("user_roles").select("*").eq("user_id", uid).eq("role", "admin").maybeSingle();
  return !!data;
}

/** Sign-in accepts a real email or a phone number used as a username. */
export async function signInWithIdentifier(identifier: string, password: string) {
  const auth = getFbAuth();
  await setPersistence(auth, browserLocalPersistence).catch(() => {});
  const id = identifier.trim();
  if (id.includes("@")) return signInWithEmailAndPassword(auth, id, password);

  const digits = digitsOnly(id);
  const { data: profiles } = await fdb.from("profiles").select("*");
  const match = profiles.find((p) => digitsOnly(String(p.phone ?? "")) === digits);
  const candidates = [match?.email, phoneToAuthEmail(digits)].filter(Boolean) as string[];
  let last: unknown = new Error("No account found for that number.");
  for (const email of candidates) {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

export async function signUpWithIdentifier(input: {
  identifier: string;
  password: string;
  name?: string;
  phone?: string;
}) {
  const auth = getFbAuth();
  await setPersistence(auth, browserLocalPersistence).catch(() => {});
  const id = input.identifier.trim();
  const isEmail = id.includes("@");
  const email = isEmail ? id : phoneToAuthEmail(id);
  const phone = digitsOnly(input.phone ?? (isEmail ? "" : id)) || undefined;
  const cred = await createUserWithEmailAndPassword(auth, email, input.password);
  await ensureProfile(cred.user, { ...(input.name ? { name: input.name } : {}), ...(phone ? { phone } : {}) });
  return cred;
}

export async function signInWithGoogle() {
  const auth = getFbAuth();
  await setPersistence(auth, browserLocalPersistence).catch(() => {});
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  await ensureProfile(cred.user);
  return cred;
}

/** Friendly copy for the auth codes users actually hit. */
export function authMessage(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const map: Record<string, string> = {
    "auth/invalid-credential": "Wrong login details. Check your number/email and password.",
    "auth/wrong-password": "Wrong login details. Check your number/email and password.",
    "auth/user-not-found": "No account found. Create one first.",
    "auth/email-already-in-use": "That account already exists. Sign in instead.",
    "auth/weak-password": "Use at least 6 characters for the password.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/operation-not-allowed": "This sign-in method is not enabled yet.",
    "auth/unauthorized-domain": "This site is not authorised for sign-in yet.",
    "permission-denied": "Your account was created, but saving your profile was blocked.",
    unavailable: "Cannot reach the server right now. Try again.",
  };
  for (const [code, message] of Object.entries(map)) if (raw.includes(code)) return message;
  return /firebase|firestore/i.test(raw)
    ? "Something went wrong while saving your account. Please try again."
    : raw || "Something went wrong.";
}

export const db = {
  from: (table: string) => fdb.from(table),
  auth: {
    currentUser: () => toSessionUser(getFbAuth().currentUser),
    getUser: async () => ({ data: { user: toSessionUser(getFbAuth().currentUser) }, error: null }),
    getSession: async () => {
      const user = toSessionUser(getFbAuth().currentUser);
      return { data: { session: user ? { user } : null }, error: null };
    },
    signOut: () => signOut(getFbAuth()),
  },
};

export { fdb, nowIso, uuid };

/** Serverless bootstrap: the first signed-in user can take the admin seat. */
export async function claimFirstAdmin() {
  const user = getFbAuth().currentUser;
  if (!user) throw new Error("Sign in first");
  const { data: roles, error } = await fdb.from("user_roles").select("*").eq("role", "admin");
  if (error) throw error;
  if (roles.some((r) => r.user_id !== user.uid)) return false;
  await ensureProfile(user);
  const { data: mine } = await fdb.from("user_roles").select("*").eq("user_id", user.uid).maybeSingle();
  if (mine) await fdb.from("user_roles").update({ role: "admin" }).eq("id", String(mine.id));
  else await fdb.from("user_roles").insert({ id: uuid(), user_id: user.uid, role: "admin", created_at: nowIso() });
  return true;
}
