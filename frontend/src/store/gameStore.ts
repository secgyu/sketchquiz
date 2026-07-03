import { create } from "zustand";

import type { ChatMessage } from "@/lib/mock";
import type { DrawStroke, Player } from "@/lib/socket";
import { useRoomStore } from "@/store/roomStore";

/** selecting: 출제자가 단어 고르는 중 · drawing: 진행 중 · reveal: 턴 종료 정답 공개 · idle: 게임 전/후 */
export type Phase = "idle" | "selecting" | "drawing" | "reveal";

/** 턴 종료 시점의 정답 공개 정보 */
export interface TurnReveal {
  word: string;
  correctGuessers: string[]; // 정답자 닉네임
  players: { nickname: string; score: number }[]; // 현재까지 점수판
}

interface GameStore {
  turnKey: number; // 턴마다 증가 → 캔버스 리마운트(초기화) 키로 사용
  phase: Phase;
  round: number;
  totalRounds: number;
  drawerId: string;
  wordLength: number;
  duration: number; // 현재 단계 제한시간(초)
  deadline: number; // 종료 시각(epoch ms) → 마운트 시점과 무관하게 남은시간 계산
  myWord: string; // 출제자 본인이 정한 단어(로컬 표시용, 남에겐 안 감)
  choices: string[]; // 출제자 본인에게만 온 3지선다 후보 (선택 전까지)
  syncStrokes: DrawStroke[]; // 재접속 시 한 번 재생할 캔버스 획 (평소엔 빈 배열)
  correctIds: string[]; // 이번 턴 정답자 id (체크 표시용)
  messages: ChatMessage[];
  ranking: Player[]; // game:ended 최종 순위
  correctFlash: number; // 본인이 정답을 맞힌 순간 증가 → "정답!" 오버레이 트리거
  reveal: TurnReveal | null; // 턴 종료 공개 오버레이 (없으면 null)

  onTurn: (p: { round: number; totalRounds: number; drawerId: string; selectDuration: number }) => void;
  onSync: (p: {
    round: number;
    totalRounds: number;
    drawerId: string;
    phase: "selecting" | "drawing";
    wordLength: number;
    remainingSec: number;
    correctIds: string[];
    strokes: DrawStroke[];
    word?: string;
    choices?: string[];
  }) => void;
  onWordChoices: (choices: string[]) => void;
  onTurnStart: (p: { wordLength: number; duration: number }) => void;
  onTurnEnd: (p: TurnReveal & { duration: number }) => void;
  onChat: (p: { nickname: string; text: string }) => void;
  onCorrect: (p: { playerId: string; nickname: string }) => void;
  onPlayerLeft: (nickname: string) => void;
  flashCorrect: () => void;
  onEnded: (ranking: Player[]) => void;
  setMyWord: (word: string) => void;
  reset: () => void;
}

const initial = {
  turnKey: 0,
  phase: "idle" as Phase,
  round: 0,
  totalRounds: 0,
  drawerId: "",
  wordLength: 0,
  duration: 0,
  deadline: 0,
  myWord: "",
  choices: [] as string[],
  syncStrokes: [] as DrawStroke[],
  correctIds: [] as string[],
  messages: [] as ChatMessage[],
  ranking: [] as Player[],
  correctFlash: 0,
  reveal: null as TurnReveal | null,
};

function message(kind: ChatMessage["kind"], text: string, nickname?: string): ChatMessage {
  return { id: crypto.randomUUID(), kind, text, nickname };
}

/** 서버 소켓 이벤트로만 갱신되는 게임 진행 상태. 진실의 원천은 서버다. */
export const useGameStore = create<GameStore>((set) => ({
  ...initial,

  onTurn: ({ round, totalRounds, drawerId, selectDuration }) => {
    const drawer = useRoomStore.getState().room?.players.find((p) => p.id === drawerId);
    const turnMsg = message("system", `${drawer?.nickname ?? "누군가"}님이 그릴 차례예요!`);
    set((s) => ({
      turnKey: s.turnKey + 1,
      phase: "selecting",
      round,
      totalRounds,
      drawerId,
      wordLength: 0,
      duration: selectDuration,
      deadline: Date.now() + selectDuration * 1000,
      myWord: "",
      choices: [], // 새 턴 시작 → 후보는 word-choices로 다시 채워진다(출제자 한정)
      syncStrokes: [], // 새 턴엔 복원할 획이 없다(캔버스는 깨끗이 시작)
      correctIds: [],
      reveal: null, // 이전 턴 공개 오버레이 제거
      // 채팅 로그는 게임 내내 유지하고, 새 게임(직전 phase가 idle)일 때만 비운다.
      messages: s.phase === "idle" ? [turnMsg] : [...s.messages, turnMsg],
    }));
  },

  // 재접속 스냅샷으로 진행 중인 게임 화면을 통째로 복원한다(그림 획·채팅 기록은 복원 대상 아님).
  onSync: ({ round, totalRounds, drawerId, phase, wordLength, remainingSec, correctIds, strokes, word, choices }) =>
    set((s) => ({
      turnKey: s.turnKey + 1,
      phase,
      round,
      totalRounds,
      drawerId,
      wordLength,
      duration: remainingSec,
      deadline: Date.now() + remainingSec * 1000,
      myWord: word ?? "",
      choices: choices ?? [],
      syncStrokes: strokes, // 새로 마운트되는 캔버스가 이 획들을 한 번 재생한다
      correctIds,
      reveal: null,
      messages: [message("system", "게임에 다시 연결했어요.")],
    })),

  onWordChoices: (choices) => set({ choices }),

  onTurnStart: ({ wordLength, duration }) =>
    set({ phase: "drawing", wordLength, duration, deadline: Date.now() + duration * 1000, choices: [] }),

  onTurnEnd: ({ word, correctGuessers, players, duration }) =>
    set((s) => ({
      phase: "reveal",
      reveal: { word, correctGuessers, players },
      duration,
      deadline: Date.now() + duration * 1000,
      messages: [...s.messages, message("system", `정답은 '${word}' 였어요!`)],
    })),

  onChat: ({ nickname, text }) => set((s) => ({ messages: [...s.messages, message("chat", text, nickname)] })),

  onCorrect: ({ playerId, nickname }) =>
    set((s) => ({
      correctIds: [...s.correctIds, playerId],
      messages: [...s.messages, message("correct", `${nickname}님이 정답을 맞혔어요!`, nickname)],
    })),

  onPlayerLeft: (nickname) =>
    set((s) => ({ messages: [...s.messages, message("system", `${nickname}님이 나갔어요.`)] })),

  flashCorrect: () => set((s) => ({ correctFlash: s.correctFlash + 1 })),

  onEnded: (ranking) => set({ phase: "idle", ranking, reveal: null }),

  setMyWord: (myWord) => set({ myWord }),

  reset: () => set({ ...initial }),
}));
