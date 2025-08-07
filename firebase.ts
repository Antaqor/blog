// lib/firebase.ts
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBsd8CmzMA4U_p3B5Bimpyne4gRHmHlGR8",
  authDomain: "yuki-906f3.firebaseapp.com",
  projectId: "yuki-906f3",
  storageBucket: "yuki-906f3.appspot.com", // Correct!
  messagingSenderId: "91239365480",
  appId: "1:91239365480:web:2ad7d59ebe48941a9874dd",
  measurementId: "G-PJ6JKLKMQC",
};

// Avoid re-initializing for hot-reload (Next.js)
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Analytics only works client-side (not in SSR)
let analytics: Analytics | undefined = undefined;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

const firestore: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

export { app as firebaseApp, analytics as firebaseAnalytics, firestore, auth, storage };
