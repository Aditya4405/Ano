"use client";

import React from "react";
import { usePresenceStore } from "@/store/usePresenceStore";
import type { UserPresence as UserPresenceModel, PresenceStatus } from "@/store/usePresenceStore";
import { Gamepad2, Eye } from "lucide-react";

export interface UserPresenceProps {
  userId?: string;
  presence?: UserPresenceModel | null;
  fallbackStatus?: PresenceStatus;
  variant?: "badge" | "dot" | "full" | "inline" | "avatar-badge";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

export function UserPresenceBadge({
  userId,
  presence: directPresence,
  fallbackStatus,
  variant = "badge",
  size = "sm",
  className = "",
  showText = true,
}: UserPresenceProps) {
  const storePresence = usePresenceStore((s) => (userId ? s.presences[userId] : null));
  const isUserInOnlineSet = usePresenceStore((s) => (userId ? s.onlineUserIds.has(userId) : false));

  const presence: UserPresenceModel = directPresence || storePresence || {
    userId: userId || "",
    status: fallbackStatus || (isUserInOnlineSet ? "ONLINE" : "OFFLINE"),
    game: null,
    updatedAt: Date.now(),
  };

  const status = presence.status;
  const isPlaying = status === "PLAYING";
  const isOnline = status === "ONLINE" || isPlaying;
  const game = presence.game;
  const isSpectating = game?.isSpectating || false;
  const gameName = game?.gameName || (isPlaying ? "a game" : "");

  // Label text
  let statusText = "Offline";
  if (isPlaying) {
    statusText = isSpectating ? `Spectating ${gameName}` : `Playing ${gameName}`;
  } else if (isOnline) {
    statusText = "Online";
  }

  // --- VARIANT: avatar-badge (small absolute dot/icon on avatars) ---
  if (variant === "avatar-badge") {
    if (isPlaying) {
      return (
        <span
          title={statusText}
          className={`absolute bottom-0 right-0 rounded-full border-2 border-zinc-950 flex items-center justify-center shadow-md ${
            size === "xs"
              ? "w-2.5 h-2.5 bg-indigo-500"
              : size === "sm"
              ? "w-3 h-3 bg-indigo-500"
              : "w-3.5 h-3.5 bg-gradient-to-tr from-indigo-600 to-purple-500 text-white"
          } ${className}`}
        >
          {size === "lg" && <Gamepad2 className="w-2 h-2 text-white" />}
        </span>
      );
    }

    return (
      <span
        title={statusText}
        className={`absolute bottom-0 right-0 rounded-full border-2 border-zinc-950 ${
          isOnline ? "bg-emerald-500" : "bg-zinc-600"
        } ${
          size === "xs" ? "w-2 h-2" : size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"
        } ${className}`}
      />
    );
  }

  // --- VARIANT: dot ---
  if (variant === "dot") {
    if (isPlaying) {
      return (
        <span
          title={statusText}
          className={`inline-flex items-center gap-1.5 ${className}`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
          </span>
          {showText && (
            <span className="text-xs font-medium text-indigo-400 truncate max-w-[140px]" title={statusText}>
              {statusText}
            </span>
          )}
        </span>
      );
    }

    return (
      <span
        title={statusText}
        className={`inline-flex items-center gap-1.5 ${className}`}
      >
        <span
          className={`rounded-full ${
            isOnline ? "bg-emerald-500" : "bg-zinc-600"
          } ${size === "xs" ? "w-1.5 h-1.5" : size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5"}`}
        />
        {showText && (
          <span className={`text-xs ${isOnline ? "text-emerald-400" : "text-zinc-500"}`}>
            {statusText}
          </span>
        )}
      </span>
    );
  }

  // --- VARIANT: full (for chat header, profile subtitle, member rows) ---
  if (variant === "full") {
    if (isPlaying) {
      return (
        <div className={`flex items-center gap-1.5 ${className}`} title={statusText}>
          {isSpectating ? (
            <Eye className="w-3.5 h-3.5 text-indigo-400 animate-pulse flex-shrink-0" />
          ) : (
            <Gamepad2 className="w-3.5 h-3.5 text-indigo-400 animate-pulse flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-indigo-300 truncate max-w-[180px] sm:max-w-[240px]">
            {statusText}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-75 flex-shrink-0" title="Online" />
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isOnline ? "bg-emerald-500" : "bg-zinc-600"
          }`}
        />
        <span
          className={`text-xs ${
            isOnline ? "text-emerald-400 font-medium" : "text-zinc-500"
          }`}
        >
          {statusText}
        </span>
      </div>
    );
  }

  // --- VARIANT: inline ---
  if (variant === "inline") {
    if (isPlaying) {
      return (
        <span
          title={statusText}
          className={`inline-flex items-center gap-1 text-xs font-medium text-indigo-400 ${className}`}
        >
          {isSpectating ? <Eye className="w-3 h-3 flex-shrink-0" /> : <Gamepad2 className="w-3 h-3 flex-shrink-0" />}
          <span className="truncate max-w-[130px]">{gameName}</span>
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 text-xs ${
          isOnline ? "text-emerald-400" : "text-zinc-500"
        } ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-zinc-600"}`} />
        {statusText}
      </span>
    );
  }

  // --- DEFAULT VARIANT: badge (Pill style for profile cards, online users list, search modals) ---
  if (isPlaying) {
    return (
      <span
        title={statusText}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm max-w-full truncate ${className}`}
      >
        {isSpectating ? (
          <Eye className="w-3 h-3 text-indigo-400 flex-shrink-0" />
        ) : (
          <Gamepad2 className="w-3 h-3 text-indigo-400 flex-shrink-0" />
        )}
        <span className="truncate">{statusText}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        isOnline
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          : "bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
      } ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-zinc-500"}`} />
      <span>{statusText}</span>
    </span>
  );
}

export const UserPresence = UserPresenceBadge;
