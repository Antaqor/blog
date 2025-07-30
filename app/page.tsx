"use client";

import { useCallback, useEffect, useMemo, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { firestore, auth, storage } from "@/firebase";
import {
    collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
    FirestoreDataConverter, Timestamp, QueryDocumentSnapshot,
    doc, getDocs, where, documentId
} from "firebase/firestore";
import {
    ref, uploadBytesResumable, getDownloadURL, type UploadMetadata,
} from "firebase/storage";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import type { FirebaseError } from "firebase/app";

// ---------- Types ----------
type ServerTimestamp = ReturnType<typeof serverTimestamp>;
type PostDoc = { title: string; content: string; imageUrl?: string | null; created: Timestamp | ServerTimestamp; uid: string; };
type Post = PostDoc & { id: string };
type UserProfile = { photoURL?: string | null; displayName?: string | null; email?: string | null };

const postConverter: FirestoreDataConverter<PostDoc> = {
    toFirestore: (post: PostDoc) => post,
    fromFirestore: (snap: QueryDocumentSnapshot): PostDoc => (snap.data() as PostDoc),
};

const POSTS_COLLECTION = "posts";
const MAX_MB = 5;

const safeDate = (ts: Timestamp | ServerTimestamp | null | undefined) =>
    ts && ts instanceof Timestamp ? ts.toDate().toLocaleString() : "…";

const validateImage = (file: File | null): string | null => {
    if (!file) return null;
    if (!file.type.startsWith("image/")) return "Only image files are allowed.";
    if (file.size > MAX_MB * 1024 * 1024) return `Image must be < ${MAX_MB}MB.`;
    return null;
};

async function uploadImageOrThrow(file: File, uid: string, onProgress?: (pct: number)=>void) {
    const cleanName = file.name.replace(/\s+/g, "-").toLowerCase();
    const path = `posts/${uid}/${Date.now()}-${cleanName}`;
    const imageRef = ref(storage, path);
    const metadata: UploadMetadata = { contentType: file.type };

    return await new Promise<string>((resolve, reject) => {
        const task = uploadBytesResumable(imageRef, file, metadata);
        const timer = setTimeout(() => { try { task.cancel(); } catch {}; reject(new Error("upload-timeout")); }, 60_000);

        task.on("state_changed",
            (snap) => {
                const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                onProgress?.(pct);
            },
            (err) => { clearTimeout(timer); reject(err); },
            async () => { clearTimeout(timer); resolve(await getDownloadURL(task.snapshot.ref)); }
        );
    });
}

// Avatar with fallback initial
function Avatar({ src, alt, size = 8, fallback }:{
    src?: string | null; alt: string; size?: 6 | 8; fallback?: string | null | undefined;
}) {
    const sz = size === 6 ? "w-6 h-6" : "w-8 h-8";
    if (src) return <img src={src} alt={alt} className={`${sz} rounded-full object-cover`} />;
    const init = (fallback?.trim()?.[0] || "?").toUpperCase();
    return (
        <div className={`${sz} rounded-full bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-white flex items-center justify-center text-xs`}>
            {init}
        </div>
    );
}

const chunk = <T,>(arr: T[], n = 10) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
};

export default function Home() {
    const [user, setUser] = useState<User | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fetchingUids = useRef<Set<string>>(new Set());

    useEffect(() => onAuthStateChanged(auth, setUser), []);

    // Posts stream
    useEffect(() => {
        const postsCol = collection(firestore, POSTS_COLLECTION).withConverter(postConverter);
        const postsQuery = query(postsCol, orderBy("created", "desc"));
        return onSnapshot(
            postsQuery,
            (snap) => setPosts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as PostDoc) }))),
            () => setError("Failed to load posts.")
        );
    }, []);

    // Batch fetch user profiles for posts (+ me)
    useEffect(() => {
        const need = new Set<string>(posts.map(p => p.uid));
        if (user?.uid) need.add(user.uid);
        const missing = [...need].filter(uid => !profiles[uid] && !fetchingUids.current.has(uid));
        if (!missing.length) return;
        missing.forEach(uid => fetchingUids.current.add(uid));
        (async () => {
            try {
                const result: Record<string, UserProfile> = {};
                for (const ids of chunk(missing, 10)) {
                    const qs = await getDocs(query(collection(firestore, "users"), where(documentId(), "in", ids)));
                    qs.forEach(d => {
                        const data = d.data() as any;
                        result[d.id] = {
                            photoURL: data.photoURL ?? data.avatarUrl ?? null,
                            displayName: data.displayName ?? null,
                            email: data.email ?? null,
                        };
                    });
                }
                if (user?.uid && user.photoURL && !result[user.uid]) {
                    result[user.uid] = { ...(result[user.uid] || {}), photoURL: user.photoURL };
                }
                setProfiles(prev => ({ ...prev, ...result }));
            } finally {
                missing.forEach(uid => fetchingUids.current.delete(uid));
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [posts, user]);

    const canSubmit = useMemo(() => !!user && title.trim() && content.trim() && !submitting,
        [user, title, content, submitting]);

    const addPost = useCallback(async (e?: FormEvent) => {
        e?.preventDefault();
        if (!canSubmit) return;
        setSubmitting(true); setError(null); setProgress(0);
        try {
            const imgErr = validateImage(image);
            if (imgErr) throw new Error(imgErr);
            let imageUrl: string | null = null;
            if (image) imageUrl = await uploadImageOrThrow(image, user!.uid, setProgress);
            const postsCol = collection(firestore, POSTS_COLLECTION).withConverter(postConverter);
            await addDoc(postsCol, {
                title: title.trim(),
                content: content.trim(),
                imageUrl,
                created: serverTimestamp(),
                uid: user!.uid,
            });
            setTitle(""); setContent(""); setImage(null); setProgress(0);
        } catch (err) {
            const fb = err as FirebaseError;
            setError(fb.code ? fb.code : (err as Error).message || "Failed to add post.");
        } finally { setSubmitting(false); }
    }, [canSubmit, image, title, content, user]);

    const signOutUser = useCallback(() => { signOut(auth).catch(() => {}); }, []);

    // ---- UI helpers ----
    const accent =
        "bg-[var(--accent-color)] text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-color)]";

    const summarize = (t: string) => (t.length > 160 ? `${t.slice(0, 160)}…` : t);

    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
            {/* Top Nav */}
            <nav className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800">
                <div className="mx-auto max-w-screen-xl px-6 h-14 flex items-center justify-between">
                    <Link href="/" className="font-semibold tracking-tight">Forward Tech</Link>
                    <ul className="hidden md:flex items-center gap-6 text-sm text-neutral-600 dark:text-neutral-300">
                        <li><a className="hover:text-black dark:hover:text-white transition-colors" href="#">Research</a></li>
                        <li><a className="hover:text-black dark:hover:text-white transition-colors" href="#">Products</a></li>
                        <li><a className="hover:text-black dark:hover:text-white transition-colors" href="#">Safety</a></li>
                        <li><a className="hover:text-black dark:hover:text-white transition-colors" href="#">News</a></li>
                    </ul>
                    <div className="flex items-center gap-3">
                        {user ? (
                            <>
                                <Avatar
                                    src={profiles[user.uid]?.photoURL ?? user.photoURL}
                                    alt="me"
                                    size={6}
                                    fallback={profiles[user.uid]?.displayName ?? profiles[user.uid]?.email ?? user.email ?? "U"}
                                />
                                <button onClick={signOutUser} className="text-sm underline">Sign out</button>
                            </>
                        ) : (
                            <Link href="/login" className="text-sm underline">Login</Link>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="mx-auto max-w-screen-xl px-6 pt-12 pb-10">
                <div className="grid gap-6 md:grid-cols-2 items-center">
                    <div className="space-y-4">
                        <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                            Clear. Focused. <span className="text-neutral-500 dark:text-neutral-400">Future‑driven news.</span>
                        </h1>
                        <p className="text-neutral-600 dark:text-neutral-300 max-w-prose">
                            Minimal distraction, maximum signal. Research, products, and safety updates—curated for builders.
                        </p>
                        <div className="flex gap-3">
                            <a href="#feed" className={`px-5 py-2 rounded-full ${accent}`}>Read updates</a>
                            <Link href="/register" className="px-5 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
                                Join
                            </Link>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 h-40 md:h-48 lg:h-56 bg-gradient-to-br from-neutral-100 to-white dark:from-neutral-900 dark:to-neutral-950"></div>
                </div>
            </section>

            <main className="mx-auto max-w-screen-xl px-6 space-y-10">
                {/* Composer */}
                {user && (
                    <section aria-label="composer" className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 p-4 md:p-6 shadow-sm">
                        <div className="flex items-start gap-3">
                            <Avatar
                                src={profiles[user.uid]?.photoURL ?? user.photoURL}
                                alt="me"
                                size={8}
                                fallback={profiles[user.uid]?.displayName ?? profiles[user.uid]?.email ?? user.email ?? "U"}
                            />
                            <form onSubmit={addPost} className="flex-1 space-y-3">
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Headline"
                                    maxLength={120}
                                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
                                />
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Write a short summary…"
                                    rows={4}
                                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
                                />
                                <div className="flex items-center gap-3">
                                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition">
                                        <input type="file" accept="image/*" className="hidden" onChange={(e)=>setImage(e.target.files?.[0] || null)} />
                                        Upload image
                                    </label>
                                    <button
                                        disabled={!canSubmit}
                                        className={`px-4 py-2 rounded-lg ${canSubmit ? accent : "bg-neutral-300 text-neutral-600 cursor-not-allowed dark:bg-neutral-700 dark:text-neutral-300"}`}
                                    >
                                        {submitting ? "Posting…" : "Post"}
                                    </button>
                                    {submitting && image && (
                                        <progress value={progress} max={100} className="h-2 w-28"></progress>
                                    )}
                                </div>
                                {image && (
                                    <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
                                        <img src={URL.createObjectURL(image)} alt="preview" className="max-h-64 w-full object-cover" />
                                    </div>
                                )}
                                {error && <p className="text-sm text-red-600">{error}</p>}
                            </form>
                        </div>
                    </section>
                )}

                {/* Feed */}
                <section id="feed" className="space-y-6">
                    <div className="flex items-baseline justify-between">
                        <h2 className="text-xl font-semibold">Latest</h2>
                    </div>

                    {posts.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center text-neutral-500">
                            No posts yet.
                        </div>
                    ) : (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {posts.map((p) => {
                                const prof = profiles[p.uid];
                                const label = prof?.displayName ?? prof?.email ?? "User";
                                const summary = summarize(p.content);

                                return (
                                    <li key={p.id} className="group rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 shadow-sm hover:shadow-md transition-shadow">
                                        {/* Image */}
                                        <div className="aspect-[16/10] overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                                            {p.imageUrl ? (
                                                <img
                                                    src={p.imageUrl}
                                                    alt={p.title}
                                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                                />
                                            ) : null}
                                        </div>

                                        {/* Content */}
                                        <div className="p-4 space-y-3">
                                            <div className="flex items-center gap-2 text-sm text-neutral-500">
                                                <Avatar src={prof?.photoURL} alt={label} size={6} fallback={label} />
                                                <span>{label}</span>
                                                <span className="mx-2">•</span>
                                                <time className="tabular-nums">{safeDate(p.created as Timestamp | null)}</time>
                                            </div>

                                            <h3 className="font-semibold text-lg leading-snug line-clamp-2">{p.title}</h3>
                                            <p className="text-sm text-neutral-600 dark:text-neutral-300 line-clamp-3">{summary}</p>

                                            <div className="pt-2">
                                                <button className="text-sm underline underline-offset-4 hover:opacity-80">Read more</button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </main>

            <footer className="mx-auto max-w-screen-xl px-6 py-10 text-sm text-neutral-500">
                © {new Date().getFullYear()} Forward Tech — minimal news for builders.
            </footer>
        </div>
    );
}
