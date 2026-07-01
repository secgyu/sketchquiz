import { useEffect, useState } from "react";

import { getSocket, type AppSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";

interface UseSocket {
  socket: AppSocket;
  connected: boolean;
}

/**
 * 세션 소켓에 연결하고 연결 상태를 구독한다.
 * 토큰이 있으면 마운트 시 연결하며, 싱글톤이므로 언마운트해도 끊지 않는다(다른 화면이 공유).
 * 인증 실패(auth:error)면 로그아웃 처리한다 → 보호 라우트가 로그인 화면으로 보낸다.
 */
export function useSocket(): UseSocket {
  const socket = getSocket();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    if (!token) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onAuthError = () => {
      toast.error("세션이 만료됐어요. 다시 로그인해 주세요.");
      logout();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("auth:error", onAuthError);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("auth:error", onAuthError);
    };
  }, [socket, token, logout]);

  return { socket, connected };
}
