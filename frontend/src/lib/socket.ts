import { io, type Socket } from "socket.io-client";

import { API_URL } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

/** 서버가 방에 내려보내는 플레이어 스냅샷 (backend game.types.Player와 동일) */
export interface Player {
  id: string;
  nickname: string;
  score: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  players: Player[];
}

export interface DrawStroke {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
}

/** 서버 → 클라이언트 이벤트 (game.gateway.ts의 emit과 1:1 대응) */
export interface ServerToClientEvents {
  "auth:error": (payload: { message: string }) => void;
  "room:error": (payload: { message: string }) => void;
  "room:state": (state: RoomState) => void;
  "game:turn": (payload: { round: number; totalRounds: number; drawerId: string; selectDuration: number }) => void;
  "game:word-request": (payload: Record<string, never>) => void;
  "game:turn-start": (payload: { wordLength: number; duration: number }) => void;
  "draw:stroke": (stroke: DrawStroke) => void;
  "draw:clear": () => void;
  "chat:correct": (payload: { playerId: string; nickname: string }) => void;
  "chat:message": (payload: { playerId: string; nickname: string; text: string }) => void;
  "player:left": (payload: { nickname: string }) => void;
  "game:ended": (payload: { ranking: Player[] }) => void;
}

/** 클라이언트 → 서버 이벤트 (game.gateway.ts의 @SubscribeMessage와 1:1 대응) */
export interface ClientToServerEvents {
  "room:create": () => void;
  "room:join": (payload: { code: string }) => void;
  "game:start": () => void;
  "game:set-word": (payload: { word: string }) => void;
  "draw:stroke": (stroke: DrawStroke) => void;
  "draw:clear": () => void;
  "chat:message": (payload: { text: string }) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ponytail: 세션 전체가 하나의 소켓을 공유한다(방/화면마다 재연결 불필요).
let socket: AppSocket | null = null;

/**
 * 소켓 싱글톤을 반환한다. 최초 호출 시 생성만 하고 자동 연결하지 않는다(autoConnect: false).
 * auth.token은 함수로 넘겨 매 연결 시 최신 JWT를 읽는다(로그인 갱신 대응).
 */
export function getSocket(): AppSocket {
  if (socket) return socket;
  socket = io(API_URL, {
    autoConnect: false,
    auth: (cb) => cb({ token: useAuthStore.getState().token ?? "" }),
  });
  return socket;
}

/** 로그아웃 등에서 연결을 완전히 끊는다. */
export function disconnectSocket(): void {
  socket?.disconnect();
}
