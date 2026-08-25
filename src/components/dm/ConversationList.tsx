"use client";

import { API_URL } from "@/lib/config";
import { useEffect } from "react";
import { useDMStore, ConversationPreview } from "@/store/useDMStore";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { UserPresence } from "@/components/ui/UserPresence";

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ConversationList() {
  const router = useRouter();
  const userId = useUserStore((s) => s.id);
  const conversations = useDMStore((s) => s.conversations);
  const setConversations = useDMStore((s) => s.setConversations);
  const conversationsLoaded = useDMStore((s) => s.conversationsLoaded);
  const activeConversationId = useDMStore((s) => s.activeConversationId);
  const dmUnreadCounts = useDMStore((s) => s.dmUnreadCounts);
  const dmTypingUsers = useDMStore((s) => s.dmTypingUsers);

  useEffect(() => {
    if (!userId || conversationsLoaded) return;

    const loadConversations = async () => {
      try {
        const res = await fetch(`${API_URL}/api/conversations/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      } catch (err) {
        console.warn("Failed to load conversations:", err);
      }
    };

    loadConversations();
  }, [userId, conversationsLoaded, setConversations]);

  const handleClick = (conv: ConversationPreview) => {
    router.push(`/dm/${conv.id}`);
  };

  if (conversations.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-50" />
        <p className="text-xs text-gray-400 font-medium">No conversations yet</p>
        <p className="text-[10px] text-gray-500 mt-0.5">Search users to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {conversations.map((conv) => {
        const unread = dmUnreadCounts[conv.id] || 0;
        const isActive = activeConversationId === conv.id;
        const typingUsers = dmTypingUsers[conv.id] || [];
        const isTyping = typingUsers.length > 0;

        let previewText = "";
        let displayTimestamp = "";
        let isMe = false;

        if (isTyping) {
          previewText = "Typing...";
        } else if (conv.lastMessage) {
          isMe = conv.lastMessage.senderId === userId;
          const prefix = isMe ? "You: " : "";
          displayTimestamp = formatTimestamp(conv.lastMessage.timestamp);

          if (conv.lastMessage.type === "image") {
            previewText = `${prefix}📷 Photo`;
          } else if (conv.lastMessage.type === "file") {
            previewText = `${prefix}📎 Document`;
          } else {
            previewText = `${prefix}${conv.lastMessage.content}`;
          }
        }

        return (
          <button
            key={conv.id}
            onClick={() => handleClick(conv)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all w-full group ${
              isActive
                ? "bg-white/10 text-white font-semibold shadow-md"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {/* Avatar with live presence indicator */}
            <div className="relative flex-shrink-0">
              <UserAvatar
                src={conv.otherUser.avatar}
                nickname={conv.otherUser.nickname}
                size="w-9 h-9"
              />
              <UserPresence userId={conv.otherUser.id} variant="avatar-badge" size="xs" />
            </div>

            {/* Conversation Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs truncate ${unread > 0 ? "font-bold text-white" : "font-medium text-gray-200"}`}>
                  {conv.otherUser.nickname}
                </span>
                {displayTimestamp && !isTyping && (
                  <span className={`text-[10px] flex-shrink-0 ml-1 ${unread > 0 ? "text-blue-400 font-semibold" : "text-gray-500"}`}>
                    {displayTimestamp}
                  </span>
                )}
              </div>

              {isTyping ? (
                <p className="text-xs text-blue-400 font-medium italic animate-pulse truncate mt-0.5">
                  Typing...
                </p>
              ) : (
                <p className={`text-xs truncate mt-0.5 ${
                  unread > 0 
                    ? "text-white font-semibold" 
                    : previewText 
                      ? "text-gray-400 group-hover:text-gray-300" 
                      : "text-gray-500 italic"
                }`}>
                  {previewText || "No messages yet"}
                </p>
              )}
            </div>

            {/* Unread badge */}
            {unread > 0 && (
              <span className="flex-shrink-0 bg-blue-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
