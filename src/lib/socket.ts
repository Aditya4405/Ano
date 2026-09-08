import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return `http://${window.location.hostname}:3001`;
    }
  }
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
  return "http://localhost:3001";
};
const SOCKET_URL = getSocketUrl();

class SocketService {
  private socket: Socket | null = null;

  connect(customUrl?: string) {
    if (customUrl || !this.socket) {
      if (this.socket) {
        this.socket.disconnect();
      }
      const targetUrl = customUrl || SOCKET_URL;
      this.socket = io(targetUrl, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        console.log('[SocketService] Connected:', this.socket?.id, 'to:', targetUrl);
      });

      this.socket.on('connect_error', (err) => {
        console.warn('[SocketService] Connection error to', targetUrl, ':', err.message);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[SocketService] Disconnected:', reason);
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  isConnected(): boolean {
    return Boolean(this.socket && this.socket.connected);
  }
}

// Singleton instance
export const socketService = new SocketService();
