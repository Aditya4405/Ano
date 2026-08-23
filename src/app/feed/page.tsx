"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useFeedStore } from "@/store/useFeedStore";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { TagFilter } from "@/components/feed/TagFilter";
import { PostCard } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { motion } from "framer-motion";
import { SquarePen, Loader2, Rss, AlertCircle, RefreshCw, Sparkles } from "lucide-react";

export default function FeedPage() {
  const router = useRouter();
  const userId = useUserStore((s) => s.id);
  const [isClient, setIsClient] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const {
    posts,
    loading,
    isLoadingMore,
    error,
    loadMoreError,
    hasMore,
    activeTab,
    activeTag,
    tags,
    setActiveTab,
    setActiveTag,
    fetchPosts,
    loadMore,
    retryLoadMore,
    fetchTags,
    voteOnPost,
    savePost,
    unsavePost,
    deletePost,
  } = useFeedStore();

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !userId) {
      router.push("/");
    }
  }, [isClient, userId, router]);

  useEffect(() => {
    if (userId) {
      fetchTags();
    }
  }, [userId, fetchTags]);

  useEffect(() => {
    if (userId) {
      fetchPosts(userId, true);
    }
  }, [userId, activeTab, activeTag, fetchPosts]);

  // Progressive infinite scroll
  const handleLoadMore = useCallback(() => {
    if (userId && hasMore && !loading && !isLoadingMore) {
      loadMore(userId);
    }
  }, [userId, hasMore, loading, isLoadingMore, loadMore]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    if (!hasMore || loading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      {
        root: null,
        rootMargin: "600px",
        threshold: 0.1,
      }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [handleLoadMore, hasMore, loading]);

  if (!isClient || !userId) return null;

  return (
    <div className="flex h-screen max-h-screen">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 pt-14 pb-12 md:px-4 md:pt-8 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-md shadow-orange-500/20">
                <Rss className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Feed</h1>
            </div>
            <FeedTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </motion.div>

          {/* Tags */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <TagFilter
              tags={tags}
              activeTag={activeTag}
              onTagChange={setActiveTag}
            />
          </motion.div>

          {/* Post list */}
          <div className="space-y-3">
            {/* Initial Fetch Error */}
            {error && (
              <div className="text-center py-12 bg-red-500/10 rounded-xl border border-red-500/20 p-6 space-y-3">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
                <p className="text-red-300 text-sm font-medium">Failed to load feed. Please check your connection.</p>
                <button
                  onClick={() => fetchPosts(userId, true)}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
              </div>
            )}

            {/* Initial Loading Skeletons */}
            {loading && posts.length === 0 && (
              <div className="space-y-3">
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </div>
            )}

            {/* Empty State */}
            {!error && !loading && posts.length === 0 && (
              <div className="text-center py-16 bg-white/5 rounded-xl border border-white/10 p-6">
                <Rss className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-300 font-semibold text-base mb-1">No posts yet</p>
                <p className="text-gray-500 text-xs mb-4">Be the first to share an update or question in this feed!</p>
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <SquarePen className="w-4 h-4" />
                  <span>Create First Post</span>
                </button>
              </div>
            )}

            {/* Render Posts */}
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onVote={(pid, val) => voteOnPost(userId, pid, val)}
                onSave={(pid) => savePost(userId, pid)}
                onUnsave={(pid) => unsavePost(userId, pid)}
                onDelete={(pid) => deletePost(pid, userId)}
                isOwner={post.authorId === userId || post.isOwner}
              />
            ))}

            {/* Progressive Loading Sentinel (Approaching trigger) */}
            {hasMore && <div ref={sentinelRef} className="h-6 -mt-3 pointer-events-none" />}

            {/* Loading More Indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400 font-medium select-none">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <span>Loading more posts...</span>
              </div>
            )}

            {/* Load More Error & Retry */}
            {loadMoreError && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Could not load more posts.</span>
                </div>
                <button
                  onClick={() => retryLoadMore(userId)}
                  className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg font-bold transition-all cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* End of Feed Message */}
            {!hasMore && posts.length > 0 && !loading && (
              <div className="text-center py-10 text-xs text-gray-500 font-medium flex items-center justify-center gap-2 select-none">
                <span className="w-10 h-px bg-white/10" />
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  You&apos;re all caught up
                </span>
                <span className="w-10 h-px bg-white/10" />
              </div>
            )}
          </div>
        </div>

        {/* Floating create button */}
        <motion.button
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          whileHover={{ scale: 1.06, y: -2 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 350, damping: 20 }}
          onClick={() => setCreateModalOpen(true)}
          className="fixed bottom-6 right-6 h-12 w-12 sm:h-14 sm:w-auto sm:px-5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2 hover:shadow-indigo-500/50 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 border border-white/20 z-30 cursor-pointer transition-all duration-300 backdrop-blur-md group"
          title="Create New Post"
          aria-label="Create New Post"
        >
          <SquarePen className="w-5 h-5 text-white transition-transform group-hover:scale-110 group-hover:-rotate-6" />
          <span className="text-sm font-bold tracking-wide hidden sm:inline">Post</span>
        </motion.button>
      </main>

      <CreatePostModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
