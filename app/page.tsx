"use client";

import { useCallback, useEffect, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import { firestore, auth, storage } from "@/firebase";
import {
    collection, addDoc, onSnapshot, query, orderBy,
    serverTimestamp, FirestoreDataConverter, Timestamp, QueryDocumentSnapshot,
    doc, getDoc,
} from "firebase/firestore";
import {
    ref, uploadBytesResumable, getDownloadURL, type UploadMetadata,
} from "firebase/storage";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import type { FirebaseError } from "firebase/app";

type ServerTimestamp = ReturnType<typeof serverTimestamp>;
type PostDoc = { title: string; content: string; imageUrl?: string | null; created: Timestamp | ServerTimestamp; uid: string; };
type Post = PostDoc & { id: string };

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

export default function Home() {
    const [user, setUser] = useState<User | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [profiles, setProfiles] = useState<Record<string, { avatarUrl?: string | null }>>({});
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => onAuthStateChanged(auth, setUser), []);

    useEffect(() => {
        const postsCol = collection(firestore, POSTS_COLLECTION).withConverter(postConverter);
        const postsQuery = query(postsCol, orderBy("created", "desc"));
        return onSnapshot(postsQuery,
            (snap) => setPosts(snap.docs.map(d => ({ id: d.id, ...(d.data() as PostDoc) }))),
            (err) => { console.error("[snapshot]", err); setError("Failed to load posts."); }
        );
    }, []);

    useEffect(() => {
        const uids = Array.from(new Set([
            ...posts.map(p => p.uid),
            ...(user ? [user.uid] : []),
        ]));
        uids.forEach(uid => {
            if (!profiles[uid]) {
                getDoc(doc(firestore, "users", uid))
                    .then(snap => snap.exists() && setProfiles(prev => ({
                        ...prev,
                        [uid]: { avatarUrl: (snap.data() as any).avatarUrl || null },
                    })))
                    .catch(err => console.error("[profile]", err));
            }
        });
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

    const signOutUser = useCallback(async () => {
        try { await signOut(auth); } catch (err) { console.error(err); }
    }, []);

    return (
        <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            <header className="flex justify-between items-center pb-4 border-b">
                <h1 className="text-3xl font-bold">Minimal Blog</h1>
                {user ? (
                    <div className="flex items-center gap-3">
                        {profiles[user.uid]?.avatarUrl && (
                            <img src={profiles[user.uid]!.avatarUrl!} alt="avatar" className="w-8 h-8 rounded-full" />
                        )}
                        <button onClick={signOutUser} className="underline">Sign out</button>
                    </div>
                ) : (
                    <Link href="/login">Login</Link>
                )}
            </header>

            {!user && <p>New here? <Link href="/register" className="underline">Register</Link></p>}

            {user && (
                <form onSubmit={addPost} className="space-y-2">
                    <input className="w-full p-2 border" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" maxLength={120} />
                    <textarea className="w-full p-2 border" value={content} onChange={e=>setContent(e.target.value)} rows={6} placeholder="Content" />
                    <input
                        className="w-full p-2 border"
                        type="file" accept="image/*"
                        onChange={e => setImage(e.target.files?.[0] || null)}
                    />
                    {image && (
                        <img src={URL.createObjectURL(image)} alt="preview" className="max-h-48 object-contain" />
                    )}
                    {submitting && image && (
                        <progress value={progress} max={100} className="w-full">{progress}%</progress>
                    )}
                    <div className="flex items-center gap-2">
                        <button disabled={!canSubmit} className={`px-4 py-2 text-white ${canSubmit ? "bg-[var(--accent-color)]" : "bg-gray-400 cursor-not-allowed"}`}>
                            {submitting ? "Adding..." : "Add Post"}
                        </button>
                        {error && <span className="text-sm text-red-600">{error}</span>}
                    </div>
                </form>
            )}

            <ul className="divide-y space-y-8">
                {posts.map(p => (
                    <li key={p.id} className="pt-8 first:pt-0 space-y-4">
                        <div className="flex items-center gap-2">
                            {profiles[p.uid]?.avatarUrl && (
                                <img src={profiles[p.uid]!.avatarUrl!} alt="author" className="w-6 h-6 rounded-full" />
                            )}
                            <h2 className="font-semibold text-2xl">{p.title}</h2>
                        </div>
                        {p.imageUrl && <img src={p.imageUrl} alt="post" className="w-full rounded" />}
                        <p className="whitespace-pre-wrap leading-relaxed">{p.content}</p>
                        <p className="text-sm text-gray-400">{safeDate(p.created as Timestamp | null)}</p>
                    </li>
                ))}
            </ul>
        </main>
    );
}
