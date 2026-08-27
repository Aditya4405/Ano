import { API_URL } from "@/lib/config";
import { create } from 'zustand';



export interface PostAuthor {
  id: string | null;
  nickname: string;
  avatar: string | null;
}

export interface FeedPost {
  id: string;
  content: string | null;
  imageUrl: string | null;
  isAnonymous: boolean;
  score: number;
  tags: string[];
  commentCount: number;
  isLocked: boolean;
  createdAt: string;
  updatedAt?: string;
  author: PostAuthor;
  authorId: string | null;
  userVote: number; // +1, -1, or 0
  isSaved: boolean;
  isOwner?: boolean;
  moderationStatus?: string;
  moderationProvider?: string;
  nudityScore?: number | null;
  goreScore?: number | null;
  rawModerationResponse?: any;
  moderatedAt?: string | null;
}

export interface FeedComment {
  id: string;
  content: string;
  isAnonymous: boolean;
  author: PostAuthor;
  authorId: string | null;
  postId: string;
  parentId: string | null;
  createdAt: string;
  replies: FeedComment[];
}

export const FEED_PAGE_SIZE = 20;

let activeAbortController: AbortController | null = null;

interface FeedState {
  posts: FeedPost[];
  loading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  loadMoreError: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  activeTab: 'latest' | 'trending';
  activeTag: string | null;
  tags: string[];
  feedGeneration: number;

  // Detail view
  currentPost: FeedPost | null;
  comments: FeedComment[];
  commentsLoading: boolean;

  // Actions
  setActiveTab: (tab: 'latest' | 'trending') => void;
  setActiveTag: (tag: string | null) => void;
  fetchPosts: (userId: string, reset?: boolean) => Promise<void>;
  loadMore: (userId: string) => Promise<void>;
  retryLoadMore: (userId: string) => Promise<void>;
  fetchTags: () => Promise<void>;
  createPost: (data: {
    authorId: string;
    content?: string;
    imageUrl?: string;
    isAnonymous?: boolean;
    tags?: string[];
  }) => Promise<FeedPost | null>;
  voteOnPost: (userId: string, postId: string, value: 1 | -1) => Promise<void>;
  savePost: (userId: string, postId: string) => Promise<void>;
  unsavePost: (userId: string, postId: string) => Promise<void>;
  deletePost: (postId: string, authorId: string) => Promise<boolean>;

  // Detail
  fetchPost: (postId: string, userId: string) => Promise<void>;
  fetchComments: (postId: string) => Promise<void>;
  addComment: (data: {
    authorId: string;
    postId: string;
    content: string;
    parentId?: string;
    isAnonymous?: boolean;
  }) => Promise<FeedComment | null>;
  deleteComment: (commentId: string, authorId: string) => Promise<boolean>;

  clearFeed: () => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  loading: false,
  isLoadingMore: false,
  error: null,
  loadMoreError: null,
  nextCursor: null,
  hasMore: true,
  activeTab: 'latest',
  activeTag: null,
  tags: [],
  feedGeneration: 0,
  currentPost: null,
  comments: [],
  commentsLoading: false,

  setActiveTab: (tab) => {
    if (get().activeTab === tab) return;
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    const nextGen = get().feedGeneration + 1;
    set({
      activeTab: tab,
      posts: [],
      nextCursor: null,
      hasMore: true,
      error: null,
      loadMoreError: null,
      loading: true,
      isLoadingMore: false,
      feedGeneration: nextGen,
    });
  },

  setActiveTag: (tag) => {
    if (get().activeTag === tag) return;
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    const nextGen = get().feedGeneration + 1;
    set({
      activeTag: tag,
      posts: [],
      nextCursor: null,
      hasMore: true,
      error: null,
      loadMoreError: null,
      loading: true,
      isLoadingMore: false,
      feedGeneration: nextGen,
    });
  },

  fetchTags: async () => {
    try {
      const res = await fetch(`${API_URL}/api/feed/tags`);
      if (res.ok) {
        const tags = await res.json();
        set({ tags });
      }
    } catch {
      // Silent fail
    }
  },

  fetchPosts: async (userId, reset = true) => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }

    const nextGen = get().feedGeneration + 1;
    const controller = new AbortController();
    activeAbortController = controller;

    const { activeTab, activeTag } = get();
    if (reset) {
      set({
        loading: true,
        isLoadingMore: false,
        error: null,
        loadMoreError: null,
        posts: [],
        nextCursor: null,
        hasMore: true,
        feedGeneration: nextGen,
      });
    } else {
      set({ loading: true, error: null, feedGeneration: nextGen });
    }

    try {
      const params = new URLSearchParams({
        tab: activeTab,
        limit: String(FEED_PAGE_SIZE),
        userId,
      });
      if (activeTag) params.set('tag', activeTag);

      const res = await fetch(`${API_URL}/api/feed?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to fetch feed');
      const data = await res.json();

      if (get().feedGeneration !== nextGen) return;

      set({
        posts: data.posts || [],
        nextCursor: data.nextCursor ?? null,
        hasMore: Boolean(data.hasMore),
        loading: false,
        isLoadingMore: false,
        error: null,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (get().feedGeneration !== nextGen) return;
      set({ error: err.message, loading: false, isLoadingMore: false });
    }
  },

  loadMore: async (userId) => {
    const { activeTab, activeTag, nextCursor, hasMore, loading, isLoadingMore, feedGeneration } = get();
    if (!hasMore || loading || isLoadingMore || !nextCursor) return;

    const currentGen = feedGeneration;
    const controller = new AbortController();
    activeAbortController = controller;

    set({ isLoadingMore: true, loadMoreError: null });

    try {
      const params = new URLSearchParams({
        tab: activeTab,
        cursor: nextCursor,
        limit: String(FEED_PAGE_SIZE),
        userId,
      });
      if (activeTag) params.set('tag', activeTag);

      const res = await fetch(`${API_URL}/api/feed?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to load more');
      const data = await res.json();

      if (get().feedGeneration !== currentGen) return;

      set((state) => {
        const existingIds = new Set(state.posts.map((p) => p.id));
        const uniqueIncoming = (data.posts || []).filter((p: FeedPost) => !existingIds.has(p.id));
        return {
          posts: [...state.posts, ...uniqueIncoming],
          nextCursor: data.nextCursor ?? null,
          hasMore: Boolean(data.hasMore),
          isLoadingMore: false,
          loadMoreError: null,
        };
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (get().feedGeneration !== currentGen) return;
      set({ isLoadingMore: false, loadMoreError: 'Could not load more posts' });
    }
  },

  retryLoadMore: async (userId) => {
    set({ loadMoreError: null });
    await get().loadMore(userId);
  },

  createPost: async (data) => {
    try {
      const res = await fetch(`${API_URL}/api/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create post');
      const post = await res.json();

      // Add to front of posts list
      set((state) => ({
        posts: [{
          ...post,
          userVote: 0,
          isSaved: false,
          author: post.isAnonymous
            ? { id: null, nickname: 'Anonymous', avatar: null }
            : post.author,
        }, ...state.posts],
      }));
      return post;
    } catch (err) {
      console.error('Failed to create post:', err);
      return null;
    }
  },

  voteOnPost: async (userId, postId, value) => {
    try {
      const res = await fetch(`${API_URL}/api/feed/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, value }),
      });
      if (!res.ok) throw new Error('Failed to vote');
      const result = await res.json();

      // Update post in list
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, score: result.score, userVote: result.userVote } : p
        ),
        currentPost: state.currentPost?.id === postId
          ? { ...state.currentPost, score: result.score, userVote: result.userVote }
          : state.currentPost,
      }));
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  },

  savePost: async (userId, postId) => {
    try {
      await fetch(`${API_URL}/api/feed/${postId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, isSaved: true } : p
        ),
        currentPost: state.currentPost?.id === postId
          ? { ...state.currentPost, isSaved: true }
          : state.currentPost,
      }));
    } catch (err) {
      console.error('Failed to save post:', err);
    }
  },

  unsavePost: async (userId, postId) => {
    try {
      await fetch(`${API_URL}/api/feed/${postId}/save`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, isSaved: false } : p
        ),
        currentPost: state.currentPost?.id === postId
          ? { ...state.currentPost, isSaved: false }
          : state.currentPost,
      }));
    } catch (err) {
      console.error('Failed to unsave post:', err);
    }
  },

  deletePost: async (postId, authorId) => {
    try {
      const res = await fetch(`${API_URL}/api/feed/${postId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId }),
      });
      if (!res.ok) return false;
      set((state) => ({
        posts: state.posts.filter((p) => p.id !== postId),
      }));
      return true;
    } catch {
      return false;
    }
  },

  fetchPost: async (postId, userId) => {
    try {
      const res = await fetch(`${API_URL}/api/feed/${postId}?userId=${userId}`);
      if (!res.ok) throw new Error('Post not found');
      const post = await res.json();
      set({ currentPost: post });
    } catch {
      set({ currentPost: null });
    }
  },

  fetchComments: async (postId) => {
    set({ commentsLoading: true });
    try {
      const res = await fetch(`${API_URL}/api/feed/${postId}/comments`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      const comments = await res.json();
      set({ comments, commentsLoading: false });
    } catch {
      set({ commentsLoading: false });
    }
  },

  addComment: async (data) => {
    try {
      const res = await fetch(`${API_URL}/api/feed/${data.postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      const comment = await res.json();

      // Update comments list — add to correct place
      set((state) => {
        if (comment.parentId) {
          // It's a reply — we'll just refetch for simplicity
          return state;
        }
        return {
          comments: [...state.comments, { ...comment, replies: [] }],
          currentPost: state.currentPost
            ? { ...state.currentPost, commentCount: state.currentPost.commentCount + 1 }
            : null,
          posts: state.posts.map((p) =>
            p.id === data.postId ? { ...p, commentCount: p.commentCount + 1 } : p
          ),
        };
      });

      // If it was a reply, refetch all comments
      if (comment.parentId) {
        await get().fetchComments(data.postId);
        // Also update counts
        set((state) => ({
          currentPost: state.currentPost
            ? { ...state.currentPost, commentCount: state.currentPost.commentCount + 1 }
            : null,
          posts: state.posts.map((p) =>
            p.id === data.postId ? { ...p, commentCount: p.commentCount + 1 } : p
          ),
        }));
      }

      return comment;
    } catch (err) {
      console.error('Failed to add comment:', err);
      return null;
    }
  },

  deleteComment: async (commentId, authorId) => {
    try {
      const res = await fetch(`${API_URL}/api/feed/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId }),
      });
      if (!res.ok) return false;
      // Refetch comments
      const { currentPost } = get();
      if (currentPost) {
        await get().fetchComments(currentPost.id);
        set((state) => ({
          currentPost: state.currentPost
            ? { ...state.currentPost, commentCount: Math.max(0, state.currentPost.commentCount - 1) }
            : null,
        }));
      }
      return true;
    } catch {
      return false;
    }
  },

  clearFeed: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    set({
      posts: [],
      loading: false,
      isLoadingMore: false,
      error: null,
      loadMoreError: null,
      nextCursor: null,
      hasMore: true,
      currentPost: null,
      comments: [],
    });
  },
}));
