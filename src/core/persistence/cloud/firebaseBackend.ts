import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import { connectAuthEmulator, getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

export type FirebaseBackendServices = {
  app: FirebaseApp;
  appCheck: AppCheck | null;
  auth: Auth;
  firestore: Firestore;
  functions: Functions;
  googleProvider: GoogleAuthProvider;
  storage: FirebaseStorage;
};

type FirebaseEnvironment = {
  apiKey: string;
  appCheckKey?: string;
  appId: string;
  authDomain: string;
  functionsRegion: string;
  projectId: string;
  storageBucket: string;
  useEmulators: boolean;
  useAppCheckDebug: boolean;
};

let cachedBackend: FirebaseBackendServices | null | undefined;

function readEnvironment(): FirebaseEnvironment | null {
  const env = import.meta.env;
  const required = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    appId: env.VITE_FIREBASE_APP_ID,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET
  };
  if (Object.values(required).some((value) => typeof value !== "string" || value.length === 0)) return null;
  return {
    ...required as FirebaseOptions & typeof required,
    appCheckKey: env.VITE_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY,
    functionsRegion: env.VITE_FIREBASE_FUNCTIONS_REGION || "us-east1",
    useEmulators: env.VITE_FIREBASE_USE_EMULATORS === "true",
    useAppCheckDebug: !import.meta.env.PROD && env.VITE_FIREBASE_APP_CHECK_DEBUG === "true"
  };
}

/** Builds the Firebase adapters once while allowing an entirely local app when unconfigured. */
export function createFirebaseBackend(): FirebaseBackendServices | null {
  if (cachedBackend !== undefined) return cachedBackend;
  const environment = readEnvironment();
  if (!environment) return (cachedBackend = null);
  if (environment.useAppCheckDebug) {
    (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  const app = getApps()[0] ?? initializeApp(environment);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(app, environment.functionsRegion);
  const storage = getStorage(app);
  if (environment.useEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  const appCheck = !environment.useEmulators && environment.appCheckKey
    ? initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(environment.appCheckKey),
        isTokenAutoRefreshEnabled: true
      })
    : null;
  const googleProvider = new GoogleAuthProvider();
  return (cachedBackend = { app, appCheck, auth, firestore, functions, googleProvider, storage });
}
