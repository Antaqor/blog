"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, firestore, storage } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);

  const register = async () => {
    setError(null);
    if (!email || !password) return;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      let avatarUrl: string | null = null;
      if (avatar) {
        const clean = avatar.name.replace(/\s+/g, "-").toLowerCase();
        const path = `avatars/${uid}/${Date.now()}-${clean}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, avatar);
        avatarUrl = await getDownloadURL(storageRef);
      }

      await setDoc(doc(firestore, "users", uid), { email, avatarUrl });
      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="max-w-sm mx-auto px-6 py-8 space-y-6 min-h-screen flex flex-col justify-center">
      <h1 className="text-2xl font-bold text-center">Register</h1>
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
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setAvatar(e.target.files?.[0] || null)}
        className="w-full p-2 border"
      />
      <button
        onClick={register}
        className="bg-[var(--accent-color)] text-white w-full py-2"
      >
        Register
      </button>
      {error && <p className="text-red-600 text-center text-sm">{error}</p>}
      <p className="text-center">
        Already have an account? <Link href="/login" className="underline">Login</Link>
      </p>
    </main>
  );
}
