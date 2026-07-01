import { create } from "zustand";

import { MOCK_MESSAGES, MOCK_PLAYERS, type ChatMessage, type Player } from "@/lib/mock";

interface GameStore {
  nickname: string;
  players: Player[];
  messages: ChatMessage[];

  setNickname: (nickname: string) => void;
  sendMessage: (text: string) => void;
}

/**
 * 목업 단계 스토어: 닉네임과 채팅만 실제로 관리한다.
 * 화면 전환/방 코드는 URL(react-router)이 진실의 원천이므로 스토어에서 다루지 않는다.
 * 플레이어/초기 채팅은 더미 데이터이며 소켓 연동 단계에서 교체한다.
 */
export const useGameStore = create<GameStore>((set, get) => ({
  nickname: "",
  players: MOCK_PLAYERS,
  messages: MOCK_MESSAGES,

  setNickname: (nickname) => set({ nickname }),

  sendMessage: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const nickname = get().nickname || "나";
    set((state) => ({
      messages: [...state.messages, { id: crypto.randomUUID(), kind: "chat", nickname, text: trimmed }],
    }));
  },
}));
