"use client";
import { API_URL } from "@/lib/config";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useDMStore } from "@/store/useDMStore";
import { usePresenceStore } from "@/store/usePresenceStore";
import { GlassModal } from "@/components/layout/GlassModal";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { UserPresence } from "@/components/ui/UserPresence";

interface SearchResult {
  id: string;
  nickname: string;
  avatar: string | null;
}

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserSearchModal({ isOpen, onClose }: UserSearchModalProps) {
  const router = useRouter();
  const myUserId = useUserStore((s) => s.id);
  const setConversationsLoaded = useDMStore((s) => s.setConversationsLoaded);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out current user
          setResults(data.filter((u: SearchResult) => u.id !== myUserId));
        }
      } catch (err) {
        console.error("User search failed:", err);
      }
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, myUserId]);

  const handleSelect = async (user: SearchResult) => {
    if (!myUserId) return;

    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAId: myUserId, userBId: user.id }),
      });
      if (res.ok) {
        const conv = await res.json();
        setConversationsLoaded(false); // Force reload conversation list
        onClose();
        router.push(`/dm/${conv.id}`);
      }
    } catch (err) {
      console.error("Failed to start conversation:", err);
    }
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Search Users">
      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a nickname to search..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {loading && (
          <div className="text-center py-4">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-4">
            No users found
          </p>
        )}

        {results.map((user) => {
          return (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
            >
              <div className="relative flex-shrink-0">
                <UserAvatar
                  src={user.avatar}
                  nickname={user.nickname}
                  size="w-10 h-10"
                />
                <UserPresence userId={user.id} variant="avatar-badge" size="sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.nickname}</p>
                <UserPresence userId={user.id} variant="inline" />
              </div>
            </button>
          );
        })}
      </div>
    </GlassModal>
  );
}
