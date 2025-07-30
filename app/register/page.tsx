// app/register/page.tsx
"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, firestore, storage } from "@/firebase";
import {
    createUserWithEmailAndPassword,
    updateProfile,
    type UserCredential,
} from "firebase/auth";
import {
    doc,
    setDoc,
    serverTimestamp,
} from "firebase/firestore";
import {
    ref,
    uploadBytes,
    getDownloadURL,
    type UploadMetadata,
} from "firebase/storage";
import type { FirebaseError } from "firebase/app";

// ======= ТА энд rules-даа тааруулж талбарын нэрээ сонгоно =======
// Хэрвээ rules чинь avatarUrl гэж байвал доорхыг "avatarUrl" болгоорой.
const AVATAR_FIELD = "photoURL" as const;
// ===============================================================

const MAX_MB = 5;

export default function RegisterPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [avatar, setAvatar] = useState<File | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validateAvatar = (file: File | null): string | null => {
        if (!file) return null; // avatar сонгох нь optional
        if (!file.type.startsWith("image/")) return "Зөвхөн зураг upload хийнэ.";
        if (file.size > MAX_MB * 1024 * 1024) return `Зураг ${MAX_MB}MB-аас багатай байх ёстой.`;
        return null;
    };

    const onSubmit = async (e?: FormEvent) => {
        e?.preventDefault();
        setError(null);

        if (!email.trim() || !password) {
            setError("Email, password хоёрыг бөглөнө.");
            return;
        }
        const imgErr = validateAvatar(avatar);
        if (imgErr) {
            setError(imgErr);
            return;
        }

        setSubmitting(true);
        try {
            // 1) Бүртгүүлж signed-in болно
            const cred: UserCredential = await createUserWithEmailAndPassword(
                auth,
                email.trim(),
                password
            );
            const uid = cred.user.uid;

            // 2) Аватар (заавал биш)
            let photoURL: string | null = null;
            if (avatar) {
                const clean = avatar.name.replace(/\s+/g, "-").toLowerCase();
                const path = `avatars/${uid}/${Date.now()}-${clean}`;
                const metadata: UploadMetadata = { contentType: avatar.type };
                const storageRef = ref(storage, path);
                await uploadBytes(storageRef, avatar, metadata);
                photoURL = await getDownloadURL(storageRef);

                // Auth профайлд тусгая (дараа нь client-д шууд харагддаг)
                await updateProfile(cred.user, { photoURL: photoURL || undefined });
            }

            // 3) Firestore дээр users/{uid}
            await setDoc(doc(firestore, "users", uid), {
                email: email.trim(),
                [AVATAR_FIELD]: photoURL,     // photoURL эсвэл avatarUrl — rules-тайгаа тааруул
                created: serverTimestamp(),
            } as Record<string, unknown>);

            router.push("/");
        } catch (err) {
            const fb = err as FirebaseError;
            setError(fb.code ?? (err as Error).message ?? "Бүртгэл амжилтгүй.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="max-w-sm mx-auto px-6 py-8 min-h-screen flex flex-col justify-center">
            <h1 className="text-2xl font-bold text-center mb-6">Register</h1>

            <form onSubmit={onSubmit} className="space-y-4">
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    autoComplete="email"
                    className="w-full p-2 border"
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete="new-password"
                    className="w-full p-2 border"
                />
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAvatar(e.target.files?.[0] || null)}
                    className="w-full p-2 border"
                />

                <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-2 text-white ${
                        submitting ? "bg-gray-500" : "bg-[var(--accent-color)]"
                    }`}
                >
                    {submitting ? "Registering..." : "Register"}
                </button>

                {error && (
                    <p className="text-red-600 text-center text-sm break-words">{error}</p>
                )}
            </form>

            <p className="text-center mt-6">
                Already have an account?{" "}
                <Link href="/login" className="underline">
                    Login
                </Link>
            </p>
        </main>
    );
}
