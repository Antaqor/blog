"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const register = async () => {
    if (!email || !password) return;
    await createUserWithEmailAndPassword(auth, email, password);
    router.push("/");
  };

  return (
    <main className="max-w-sm mx-auto p-4 space-y-4 bg-white text-black min-h-screen flex flex-col justify-center">
      <h1 className="text-xl font-bold text-center">Register</h1>
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
        onClick={register}
        className="bg-black text-white w-full py-2"
      >
        Register
      </button>
      <p className="text-center">
        Already have an account? <Link href="/login" className="underline">Login</Link>
      </p>
    </main>
  );
}
