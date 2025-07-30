// Firebase initialization
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBsd8CmzMA4U_p3B5Bimpyne4gRHmHlGR8",
  authDomain: "yuki-906f3.firebaseapp.com",
  projectId: "yuki-906f3",
  storageBucket: "yuki-906f3.firebasestorage.app",
  messagingSenderId: "91239365480",
  appId: "1:91239365480:web:2ad7d59ebe48941a9874dd",
  measurementId: "G-PJ6JKLKMQC",
};

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAnalytics = typeof window !== "undefined" ? getAnalytics(firebaseApp) : undefined;

