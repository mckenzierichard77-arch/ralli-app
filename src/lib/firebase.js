import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseApp = initializeApp({
  apiKey:            import.meta.env?.VITE_FIREBASE_API_KEY            || "",
  authDomain:        import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN        || "",
  projectId:         import.meta.env?.VITE_FIREBASE_PROJECT_ID         || "",
  storageBucket:     import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET     || "",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID|| "",
  appId:             import.meta.env?.VITE_FIREBASE_APP_ID             || "",
});

export const auth      = getAuth(firebaseApp);
export const db        = getFirestore(firebaseApp);
export const storage   = getStorage(firebaseApp);
export const gProvider = new GoogleAuthProvider();

// Used for photo ingredient scanning only — set in .env.local, never commit
export const ANTHROPIC_KEY = import.meta.env?.VITE_ANTHROPIC_KEY || "";
