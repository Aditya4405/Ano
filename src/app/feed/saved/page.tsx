"use client";
import { API_URL } from "@/lib/config";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useFeedStore, FeedPost } from "@/store/useFeedStore";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PostCard } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { motion } from "framer-motion";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";

export default function SavedPostsPage() {
  const router = useRouter();
  const userId = useUserStore((s) => s.id);
  const { voteOnPost, unsavePost } = useFeedStore();
  const [isClient, setIsClient] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !userId) router.push("/");
  }, [isClient, userId, router]);

  const fetchSaved = useCallback(async (p: number, reset = false) => {
    if (!userId) return;
    if (reset) {
      setLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const res = await fetch(`${API_URL}/api/feed/saved/${userId}?page=${p}&limit=20`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPosts((prev) => {
        if (reset) return data.posts;
        const existingIds = new Set(prev.map(item => item.id));
        const newItems = (data.posts || []).filter((item: FeedPost) => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });
      setHasMore(Boolean(data.hasMore));
      setPage(p);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchSaved(1, true);
  }, [userId, fetchSaved]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !isLoadingMore) {
          fetchSaved(page + 1);
        }
      },
      {
        root: null,
        rootMargin: "600px",
        threshold: 0.1,
      }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, isLoadingMore, page, fetchSaved]);

  const handleUnsave = async (postId: string) => {
    if (!userId) return;
    await unsavePost(userId, postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (!isClient || !userId) return null;

  return (
    <div className="flex h-screen max-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              onClick={() => router.push("/feed")}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Feed
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                <Bookmark className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Saved Posts</h1>
            </div>
          </motion.div>

          <div className="space-y-3">
            {loading && posts.length === 0 && (
              <div className="space-y-3">
                <PostSkeleton />
                <PostSkeleton />
              </div>
            )}

            {!loading && posts.length === 0 && (
              <div className="text-center py-16 bg-white/5 rounded-xl border border-white/10">
                <Bookmark className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No saved posts yet.</p>
              </div>
            )}

            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={{ ...post, isSaved: true }}
                onVote={(pid, val) => voteOnPost(userId, pid, val)}
                onSave={() => {}}
                onUnsave={handleUnsave}
              />
            ))}

            {hasMore && <div ref={sentinelRef} className="h-6 -mt-3 pointer-events-none" />}

            {isLoadingMore && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400 font-medium select-none">
                <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                <span>Loading more saved posts...</span>
              </div>
            )}

            {!hasMore && posts.length > 0 && !loading && (
              <div className="text-center py-8 text-xs text-gray-500 font-medium select-none">
                End of saved posts
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
