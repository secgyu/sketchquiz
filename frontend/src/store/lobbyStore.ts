import { create } from "zustand";

import type { PublicRoom } from "@/lib/socket";

// 기존 화면들이 이 모듈에서 타입을 가져다 쓰므로 그대로 재노출한다(진실은 socket.ts).
export type { PublicRoom, RoomStatus } from "@/lib/socket";

interface LobbyStore {
  rooms: PublicRoom[];
  setRooms: (rooms: PublicRoom[]) => void;
}

/** 공개방 목록 상태. 진실의 원천은 서버의 room:list 이벤트다. */
export const useLobbyStore = create<LobbyStore>((set) => ({
  rooms: [],
  setRooms: (rooms) => set({ rooms }),
}));
