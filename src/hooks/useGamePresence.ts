"use client";

import { useEffect } from "react";
import { socketService } from "@/lib/socket";
import { useUserStore } from "@/store/useUserStore";

/**
 * Automatically notifies the server that the user is actively playing a game.
 * Automatically clears when unmounted or when isPlaying becomes false.
 */
export function useGamePresence(
  gameType: string,
  isPlaying: boolean = true,
  gameId?: string | null
) {
  const userId = useUserStore((s) => s.id);

  useEffect(() => {
    if (!gameType || !isPlaying) return;

    const socket = socketService.getSocket();
    const emitEnter = () => {
      const s = socketService.getSocket();
      if (s && s.connected) {
        s.emit("game_enter", { gameType, gameId, userId });
      }
    };

    if (socket?.connected) {
      emitEnter();
    } else if (socket) {
      socket.on("connect", emitEnter);
    }

    return () => {
      const s = socketService.getSocket();
      if (s) {
        s.off("connect", emitEnter);
        s.emit("game_leave", { gameType, gameId, userId });
      }
    };
  }, [gameType, isPlaying, gameId, userId]);
}
