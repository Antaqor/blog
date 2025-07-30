"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { auth } from "@/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const submit = async () => {
    setError(null);
    if (!email || !password) return;
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail("");
      setPassword("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const logout = () => signOut(auth);

  if (user) {
    return (
      <main className="max-w-sm mx-auto px-6 py-8 space-y-6 min-h-screen flex flex-col justify-center">
        <h1 className="text-2xl font-bold text-center">Admin Panel</h1>
        <p className="text-center">Logged in as {user.email}</p>
        <button onClick={logout} className="bg-[var(--accent-color)] text-white py-2">Sign out</button>
        <Link href="/" className="underline text-center">Back to Home</Link>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-8 space-y-6 min-h-screen flex flex-col justify-center">
      <h1 className="text-2xl font-bold text-center">Admin Login</h1>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full p-2 border"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full p-2 border"
      />
      <button onClick={submit} className="bg-[var(--accent-color)] text-white w-full py-2">
        {mode === "login" ? "Login" : "Register"}
      </button>
      {error && <p className="text-red-600 text-center text-sm">{error}</p>}
      <p className="text-center">
        {mode === "login" ? (
          <>New here? <button onClick={() => setMode("register") } className="underline">Register</button></>
        ) : (
          <>Have an account? <button onClick={() => setMode("login") } className="underline">Login</button></>
        )}
      </p>
    </main>
  );
}
