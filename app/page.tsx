"use client";

import { useCallback, useEffect, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import { firestore, auth, storage } from "@/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  FirestoreDataConverter,
  Timestamp,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signOut, User } from "firebase/auth";

// --- Types ---
type ServerTimestamp = ReturnType<typeof serverTimestamp>;

type PostDoc = {
  title: string;
  content: string;
  imageUrl?: string | null;
  created: Timestamp | ServerTimestamp; // write: serverTimestamp(), read: Timestamp
  uid: string;
};

type Post = PostDoc & { id: string };

// --- Firestore Converter (PostDoc <-> Firestore) ---
const postConverter: FirestoreDataConverter<PostDoc> = {
  toFirestore: (post: PostDoc) => post,
  fromFirestore: (snap: QueryDocumentSnapshot): PostDoc =>
      (snap.data() as PostDoc),
};

// --- Utils ---
const POSTS_COLLECTION = "posts";

const safeDate = (ts: Timestamp | ServerTimestamp | null | undefined) => {
  return ts && ts instanceof Timestamp ? ts.toDate().toLocaleString() : "…";
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth state
  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Posts subscription
  useEffect(() => {
    const postsCol = collection(firestore, POSTS_COLLECTION).withConverter(postConverter);
    const postsQuery = query(postsCol, orderBy("created", "desc"));

    const unsub = onSnapshot(
        postsQuery,
        (snap) => {
          const list: Post[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as PostDoc) }));
          setPosts(list);
        },
        (err) => {
          console.error(err);
          setError("Failed to load posts.");
        }
    );
    return unsub;
  }, []);

  const canSubmit = useMemo(() => {
    return !!user && title.trim().length > 0 && content.trim().length > 0 && !submitting;
  }, [user, title, content, submitting]);

  const addPost = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      if (!canSubmit) return;

      setSubmitting(true);
      setError(null);

      try {
        let imageUrl: string | null = null;
        if (image) {
          const imageRef = ref(storage, `posts/${Date.now()}-${image.name}`);
          await uploadBytes(imageRef, image);
          imageUrl = await getDownloadURL(imageRef);
        }

        const postsCol = collection(firestore, POSTS_COLLECTION).withConverter(postConverter);
        const payload: PostDoc = {
          title: title.trim(),
          content: content.trim(),
          imageUrl,
          created: serverTimestamp(),
          uid: user!.uid,
        };
        await addDoc(postsCol, payload);
        setTitle("");
        setContent("");
        setImage(null);
      } catch (err) {
        console.error(err);
        setError("Failed to add post.");
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, title, content, image, user]
  );

  const signOutUser = useCallback(() => signOut(auth), []);

  return (
      <main className="max-w-xl mx-auto p-4 space-y-4">
        <header className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Minimal Blog</h1>
          {user ? (
              <button onClick={signOutUser} className="underline">Sign out</button>
          ) : (
              <Link href="/login" className="underline">Login</Link>
          )}
        </header>

        {!user && (
            <p>
              New here? <Link href="/register" className="underline">Register</Link>
            </p>
        )}

        {user && (
            <form onSubmit={addPost} className="space-y-2">
              <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  maxLength={120}
                  className="w-full p-2 border"
                  aria-label="Title"
              />
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Content"
                className="w-full p-2 border"
                rows={6}
                aria-label="Content"
            />
            <input
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
                className="w-full p-2 border"
            />
            <div className="flex items-center gap-2">
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className={`px-4 py-2 text-white ${canSubmit ? "bg-black" : "bg-gray-400 cursor-not-allowed"}`}
                >
                  {submitting ? "Adding..." : "Add Post"}
                </button>
                {error && <span className="text-sm text-red-600">{error}</span>}
              </div>
            </form>
        )}

        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post.id} className="border p-2 rounded space-y-2">
              <h2 className="font-semibold text-lg">{post.title}</h2>
              {post.imageUrl && (
                <img src={post.imageUrl} alt="post" className="w-full rounded" />
              )}
              <p className="whitespace-pre-wrap">{post.content}</p>
              <p className="text-sm text-gray-500">{safeDate(post.created as Timestamp | null)}</p>
            </li>
          ))}
        </ul>
      </main>
  );
}
