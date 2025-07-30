"use client";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    if (!email || !password) return;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="max-w-sm mx-auto px-6 py-8 space-y-6 min-h-screen flex flex-col justify-center">
      <h1 className="text-2xl font-bold text-center">Login</h1>
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
        <button
          onClick={signIn}
          className="bg-[var(--accent-color)] text-white w-full py-2"
        >
        Login
      </button>
      {error && <p className="text-red-600 text-center text-sm">{error}</p>}
      <p className="text-center">
        New here? <Link href="/register" className="underline">Register</Link>
      </p>
    </main>
  );
}
