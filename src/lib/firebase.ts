import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/** Web config is public by design — safe to keep in client code. */
export const firebaseConfig = {
  apiKey: "AIzaSyBTSFk7GSITIHQ9WxSdi1BoVvcr4FXuZe0",
  authDomain: "luo-film-2026.firebaseapp.com",
  projectId: "luo-film-2026",
  storageBucket: "luo-film-2026.firebasestorage.app",
  messagingSenderId: "119968590647",
  appId: "1:119968590647:web:a0fa449f73d06f285888b2",
  measurementId: "G-33C3LZDH92",
};

/**
 * OAuth web client ID used by Google One Tap (Firebase Console → Authentication
 * → Google → Web SDK configuration). Public value, safe in client code.
 */
export const GOOGLE_CLIENT_ID: string =
  "119968590647-57uhsuqkcv2lv6l9dm6vd0i5tsk0vvjd.apps.googleusercontent.com";


let _app: FirebaseApp | undefined;

export function firebaseApp(): FirebaseApp {
  if (!_app) _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

/** Always use these getters — never Proxy wrappers — with doc()/collection()/ref(). */
export const getDb = (): Firestore => getFirestore(firebaseApp());
export const getFbAuth = (): Auth => getAuth(firebaseApp());
export const getFbStorage = (): FirebaseStorage => getStorage(firebaseApp());

export async function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(firebaseApp());
  } catch {
    /* analytics must never break rendering */
  }
}

/** Admin identity — checked before any database read so admin can always get in. */
export const ADMIN_EMAIL = "mainplatform.nexus@gmail.com";
export const ADMIN_PHONE = "0760734679";

export const digitsOnly = (v: string) => (v ?? "").replace(/[^0-9]/g, "");
export const phoneToAuthEmail = (phone: string) => `p${digitsOnly(phone)}@luofilm.site`;
