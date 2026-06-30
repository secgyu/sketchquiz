import { create } from "zustand";

import {
  MOCK_MESSAGES,
  MOCK_PLAYERS,
  MOCK_ROOM_CODE,
  type ChatMessage,
  type Player,
  type Screen,
} from "@/lib/mock";

interface GameStore {
  screen: Screen;
  nickname: string;
  roomCode: string;
  players: Player[];
  messages: ChatMessage[];

  setNickname: (nickname: string) => void;
  setRoomCode: (roomCode: string) => void;
  createRoom: () => void;
  joinRoom: () => void;
  startGame: () => void;
  endGame: () => void;
  sendMessage: (text: string) => void;
  restart: () => void;
  leave: () => void;
}

/**
 * 목업 단계 스토어: 화면 전환과 입력값만 실제로 관리하고,
 * 플레이어/채팅은 더미 데이터로 채운다. 실제 데이터는 소켓 연동 단계에서 교체한다.
 * ponytail: 소켓 붙기 전까지 라우터 없이 screen 상태로 화면을 전환한다.
 */
export const useGameStore = create<GameStore>((set, get) => ({
  screen: "start",
  nickname: "",
  roomCode: "",
  players: MOCK_PLAYERS,
  messages: MOCK_MESSAGES,

  setNickname: (nickname) => set({ nickname }),
  setRoomCode: (roomCode) => set({ roomCode: roomCode.toUpperCase() }),

  createRoom: () => set({ roomCode: MOCK_ROOM_CODE, screen: "lobby" }),
  joinRoom: () => set({ screen: "lobby" }),
  startGame: () => set({ screen: "game" }),
  endGame: () => set({ screen: "result" }),

  sendMessage: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const nickname = get().nickname || "나";
    set((state) => ({
      messages: [
        ...state.messages,
        { id: crypto.randomUUID(), kind: "chat", nickname, text: trimmed },
      ],
    }));
  },

  restart: () => set({ screen: "lobby" }),
  leave: () => set({ screen: "start", roomCode: "", messages: MOCK_MESSAGES }),
}));
