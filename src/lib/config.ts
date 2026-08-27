export const getApiUrl = () => {
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return `http://${window.location.hostname}:3001`;
    }
  }
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
  return "http://localhost:3001";
};

export const API_URL = getApiUrl();

