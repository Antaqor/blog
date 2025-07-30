"use client";
import { useEffect, useState } from "react";
import {
  firestore,
  auth
} from "@/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  DocumentData
} from "firebase/firestore";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  User
} from "firebase/auth";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<DocumentData[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
    const postsQuery = query(
      collection(firestore, "posts"),
      orderBy("created", "desc")
    );
    const unsubPosts = onSnapshot(postsQuery, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubAuth();
      unsubPosts();
    };
  }, []);

  const signIn = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const signOutUser = () => signOut(auth);

  const addPost = async () => {
    if (!title || !content) return;
    await addDoc(collection(firestore, "posts"), {
      title,
      content,
      created: Timestamp.now(),
      uid: user?.uid,
    });
    setTitle("");
    setContent("");
  };

  return (
    <main className="max-w-xl mx-auto p-4 space-y-4">
      <header className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Minimal Blog</h1>
        {user ? (
          <button onClick={signOutUser} className="underline">
            Sign out
          </button>
        ) : (
          <button onClick={signIn} className="underline">
            Sign in with Google
          </button>
        )}
      </header>

      {user && (
        <div className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full p-2 border"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Content"
            className="w-full p-2 border"
          />
          <button onClick={addPost} className="bg-black text-white px-4 py-2">
            Add Post
          </button>
        </div>
      )}

      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.id} className="border p-2">
            <h2 className="font-semibold">{post.title}</h2>
            <p>{post.content}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
