import { create } from "zustand";

import type { RoomState } from "@/lib/socket";

interface RoomStore {
  room: RoomState | null;
  error: string | null;
  setRoom: (room: RoomState) => void;
  setError: (error: string) => void;
  reset: () => void;
}

/**
 * 서버가 내려주는 방 상태(코드·방장·플레이어)를 보관한다.
 * 방/게임/결과 화면이 공유하며, 진실의 원천은 언제나 서버의 room:state 이벤트다.
 */
export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  error: null,
  setRoom: (room) => set({ room, error: null }),
  setError: (error) => set({ error }),
  reset: () => set({ room: null, error: null }),
}));
