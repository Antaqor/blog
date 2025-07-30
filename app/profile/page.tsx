// app/profile/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import Link from "next/link";
// removed useRouter (unused)
import { auth, firestore, storage } from "@/firebase";
import { onAuthStateChanged, updateProfile, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, type UploadMetadata } from "firebase/storage";
import type { FirebaseError } from "firebase/app";

type ProfileDoc = {
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    avatarUrl?: string | null; // compatibility
    created?: unknown;
    updated?: unknown;
};

const MAX_MB = 5;

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [photoURL, setPhotoURL] = useState<string | null>(null);

    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    // FIX: provide initial value to useRef
    const unsubRef = useRef<(() => void) | null>(null);

    // auth listener
    useEffect(() => {
        unsubRef.current = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => { unsubRef.current?.(); };
    }, []);

    // load profile doc
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const snap = await getDoc(doc(firestore, "users", user.uid));
                const data = snap.data() as ProfileDoc | undefined;
                setEmail(user.email ?? data?.email ?? "");
                setDisplayName(user.displayName ?? data?.displayName ?? "");
                setPhotoURL(user.photoURL ?? data?.photoURL ?? data?.avatarUrl ?? null);
            } catch (e) {
                console.error("[profile-load]", e);
            }
        })();
    }, [user]);

    // preview
    useEffect(() => {
        if (!file) { setPreview(null); return; }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const canSave = useMemo(() => {
        if (!user) return false;
        const nameChanged = (displayName ?? "") !== (user.displayName ?? "");
        const photoChanged = !!file;
        return (nameChanged || photoChanged) && !saving;
    }, [user, displayName, file, saving]);

    const validateFile = (f: File | null): string | null => {
        if (!f) return null;
        if (!f.type.startsWith("image/")) return "Only image files are allowed.";
        if (f.size > MAX_MB * 1024 * 1024) return `Image must be ≤ ${MAX_MB}MB.`;
        return null;
    };

    const uploadAvatar = async (f: File, uid: string): Promise<string> => {
        const clean = f.name.replace(/\s+/g, "-").toLowerCase();
        const path = `avatars/${uid}/${Date.now()}-${clean}`;
        const metadata: UploadMetadata = { contentType: f.type };
        const storageRef = ref(storage, path);

        return await new Promise<string>((resolve, reject) => {
            const task = uploadBytesResumable(storageRef, f, metadata);
            const timer = setTimeout(() => { try { task.cancel(); } catch {} reject(new Error("upload-timeout")); }, 60_000);

            task.on(
                "state_changed",
                (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                (err) => { clearTimeout(timer); reject(err); },
                async () => { clearTimeout(timer); resolve(await getDownloadURL(task.snapshot.ref)); }
            );
        });
    };

    const onSave = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!user) return;
        setError(null); setOk(null);

        const fileErr = validateFile(file);
        if (fileErr) { setError(fileErr); return; }

        setSaving(true);
        try {
            let nextPhotoURL = photoURL;

            if (file) nextPhotoURL = await uploadAvatar(file, user.uid);

            await updateProfile(user, {
                displayName: displayName || undefined,
                photoURL: nextPhotoURL || undefined,
            });

            await setDoc(
                doc(firestore, "users", user.uid),
                {
                    email: user.email ?? email ?? null,
                    displayName: displayName || null,
                    photoURL: nextPhotoURL || null,
                    avatarUrl: nextPhotoURL || null, // compatibility
                    updated: serverTimestamp(),
                } as ProfileDoc,
                { merge: true }
            );

            setPhotoURL(nextPhotoURL || null);
            setFile(null); setPreview(null); setProgress(0);
            setOk("Profile updated.");
        } catch (err) {
            const fb = err as FirebaseError;
            setError(fb.code ?? (err as Error).message ?? "Failed to update.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <main className="min-h-[60vh] grid place-items-center">
                <p className="text-sm text-neutral-500">Loading…</p>
            </main>
        );
    }

    if (!user) {
        return (
            <main className="min-h-[60vh] grid place-items-center">
                <div className="text-center space-y-3">
                    <h1 className="text-2xl font-semibold">Profile</h1>
                    <p className="text-neutral-600">You need to sign in to edit your profile.</p>
                    <Link href="/login" className="underline">Go to login</Link>
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-screen-md px-6 py-8 space-y-8">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl md:text-3xl font-bold">Your Profile</h1>
                <Link href="/" className="text-sm underline">Back to feed</Link>
            </header>

            <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 p-6 shadow-sm">
                <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
                    {/* Avatar */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                            <img
                                src={preview || photoURL || "/placeholder.svg"}
                                alt="avatar"
                                className="h-32 w-32 rounded-full object-cover border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800"
                            />
                            {saving && (
                                <div className="absolute inset-0 rounded-full bg-black/10 grid place-items-center text-xs">
                                    {progress}%
                                </div>
                            )}
                        </div>

                        <label className="text-sm cursor-pointer px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                            Change avatar
                        </label>

                        {file && (
                            <button
                                type="button"
                                onClick={() => { setFile(null); setPreview(null); setProgress(0); }}
                                className="text-xs text-neutral-600 underline"
                            >
                                Remove selected
                            </button>
                        )}
                    </div>

                    {/* Fields */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-neutral-500 mb-1">Email</label>
                            <input
                                value={email}
                                readOnly
                                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-neutral-600 dark:text-neutral-300"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-neutral-500 mb-1">Display name</label>
                            <input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your name"
                                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
                            />
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={!canSave}
                                className={`px-5 py-2 rounded-lg text-white ${
                                    canSave
                                        ? "bg-[var(--accent-color)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-color)]"
                                        : "bg-neutral-300 dark:bg-neutral-700 cursor-not-allowed text-neutral-600 dark:text-neutral-300"
                                }`}
                            >
                                {saving ? "Saving…" : "Save changes"}
                            </button>

                            {ok && <span className="text-sm text-green-600">{ok}</span>}
                            {error && <span className="text-sm text-red-600">{error}</span>}
                        </div>
                    </div>
                </form>
            </section>
        </main>
    );
}
