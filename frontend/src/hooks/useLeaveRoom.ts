import { useCallback } from "react";
import { useNavigate } from "react-router";

import { disconnectSocket } from "@/lib/socket";
import { useGameStore } from "@/store/gameStore";
import { useRoomStore } from "@/store/roomStore";

/** 방을 완전히 떠난다: 소켓 종료 + 방·게임 상태 초기화 + 홈으로 이동. */
export function useLeaveRoom(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    disconnectSocket();
    useGameStore.getState().reset();
    useRoomStore.getState().reset();
    navigate("/");
  }, [navigate]);
}
