/**
 * 프론트-백 공유 실시간 통신 계약(단일 소스 오브 트루스).
 * 서버(게이트웨이)와 클라이언트(socket.ts)가 이 파일 하나만 바라본다.
 *
 * 프론트는 `import type`로만 참조하므로 번들에 서버 코드가 섞이지 않는다(전부 컴파일 시 제거).
 * 여기엔 "선(wire)"에 오가는 타입만 둔다. GameState·ServerPlayer 등 서버 내부 타입은 game.types에 남긴다.
 */
import type {
  CreateRoomPayload,
  DrawStroke,
  Player,
  PublicRoomSummary,
  RoomState,
  TurnPhase,
} from './game.types';

export type {
  CreateRoomPayload,
  DrawStroke,
  Player,
  PublicRoomSummary,
  RoomState,
  RoomStatus,
} from './game.types';

export interface TurnPayload {
  round: number;
  totalRounds: number;
  drawerId: string;
  selectDuration: number;
}

export interface WordChoicesPayload {
  choices: string[];
  duration: number;
}

export interface TurnStartPayload {
  wordLength: number;
  duration: number;
}

export interface TurnEndPayload {
  word: string;
  correctGuessers: string[];
  players: { nickname: string; score: number }[];
  duration: number;
}

/** 재접속한 클라이언트에게만 보내는 현재 상태 스냅샷 (화면 복원용) */
export interface GameSyncPayload {
  round: number;
  totalRounds: number;
  drawerId: string;
  phase: TurnPhase;
  wordLength: number; // selecting 단계면 0
  remainingSec: number; // 현재 단계 남은 시간
  correctIds: string[]; // 이번 턴 이미 맞힌 사람들의 socket id
  strokes: DrawStroke[]; // 지금까지 그려진 획 — 재접속 시 캔버스 복원용
  word?: string; // 본인이 출제자일 때만 (본인 제시어 표시)
  choices?: string[]; // 본인이 출제자이고 아직 고르는 중일 때만
}

/** 서버 → 클라이언트 이벤트 */
export interface ServerToClientEvents {
  'auth:error': (payload: { message: string }) => void;
  'room:error': (payload: { message: string }) => void;
  'room:state': (state: RoomState) => void;
  'room:list': (rooms: PublicRoomSummary[]) => void;
  'game:turn': (payload: TurnPayload) => void;
  'game:word-choices': (payload: WordChoicesPayload) => void;
  'game:turn-start': (payload: TurnStartPayload) => void;
  'game:turn-end': (payload: TurnEndPayload) => void;
  'game:sync': (payload: GameSyncPayload) => void;
  'game:ended': (payload: { ranking: Player[] }) => void;
  'draw:stroke': (stroke: DrawStroke) => void;
  'draw:clear': () => void;
  'chat:correct': (payload: { playerId: string; nickname: string }) => void;
  'chat:message': (payload: {
    playerId: string;
    nickname: string;
    text: string;
  }) => void;
  'player:left': (payload: { nickname: string }) => void;
}

/** 클라이언트 → 서버 이벤트 */
export interface ClientToServerEvents {
  'room:create': (
    options: CreateRoomPayload,
    ack: (room: RoomState) => void,
  ) => void;
  'room:update': (options: CreateRoomPayload) => void;
  'room:join': (payload: { code: string }) => void;
  'game:start': () => void;
  'game:set-word': (payload: { word: string }) => void;
  'draw:stroke': (stroke: DrawStroke) => void;
  'draw:clear': () => void;
  'chat:message': (payload: { text: string }) => void;
  'lobby:join': (ack: (rooms: PublicRoomSummary[]) => void) => void;
  'lobby:leave': () => void;
}
