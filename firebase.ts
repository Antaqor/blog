import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAnalytics, Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBsd8CmzMA4U_p3B5Bimpyne4gRHmHlGR8",
  authDomain: "yuki-906f3.firebaseapp.com",
  projectId: "yuki-906f3",
  storageBucket: "yuki-906f3.appspot.com", // default; we override below with gs:// for safety
  messagingSenderId: "91239365480",
  appId: "1:91239365480:web:2ad7d59ebe48941a9874dd",
  measurementId: "G-PJ6JKLKMQC",
};

// avoid double init
const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

// IMPORTANT: your console shows `gs://yuki-906f3.firebasestorage.app`.
// Force the SDK to use that exact bucket host to avoid retries/hangs.
const storage: FirebaseStorage = getStorage(app, "gs://yuki-906f3.firebasestorage.app");

const firestore: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

let analytics: Analytics | undefined;
if (typeof window !== "undefined") {
  try { analytics = getAnalytics(app); } catch {}
}

export { app as firebaseApp, firestore, auth, storage, analytics as firebaseAnalytics };
