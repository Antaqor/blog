"use client";

import { useEffect, useState, useMemo } from "react";
import { firestore } from "@/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type FirestoreDataConverter,
  type Timestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import LatestNewsSection, { NewsItem } from "@/components/LatestNewsSection";

type ServerTimestamp = ReturnType<typeof serverTimestamp>;
export type PostDoc = {
  title: string;
  content: string;
  imageUrl?: string | null;
  created: Timestamp | ServerTimestamp;
  uid: string;
};
export type Post = PostDoc & { id: string };

const postConverter: FirestoreDataConverter<PostDoc> = {
  toFirestore: (post: PostDoc) => post,
  fromFirestore: (snap: QueryDocumentSnapshot): PostDoc => snap.data() as PostDoc,
};

const safeDate = (ts: Timestamp | ServerTimestamp | null | undefined) =>
  ts && ts instanceof Timestamp ? ts.toDate().toLocaleDateString() : "…";

export default function NewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const postsCol = collection(firestore, "posts").withConverter(postConverter);
    const postsQuery = query(postsCol, orderBy("created", "desc"));
    return onSnapshot(postsQuery, (snap) =>
      setPosts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as PostDoc) })))
    );
  }, []);

  const newsItems = useMemo<NewsItem[]>(
    () =>
      posts.slice(0, 6).map((p, idx) => ({
        id: idx + 1,
        title: p.title,
        date: safeDate(p.created as Timestamp | null),
        category: "Post",
        imageUrl:
          p.imageUrl || `https://source.unsplash.com/random/800x800?news,${idx}`,
      })),
    [posts]
  );

  return <LatestNewsSection items={newsItems} />;
}
