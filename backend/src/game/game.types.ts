export interface Player {
  id: string; // socket id
  nickname: string;
  score: number;
}

export type GameStatus = 'playing' | 'ended';

export interface GameState {
  status: GameStatus;
  round: number; // 현재 라운드 (1-based)
  totalRounds: number;
  order: string[]; // 게임 시작 시점 플레이어 id 순서 (턴 순서)
  turnIndex: number; // 현재 라운드 내 턴 위치 (order 인덱스)
  drawerId: string; // 현재 출제자 socket id
  word: string; // 현재 제시어 (서버 비밀)
}

export interface Room {
  code: string;
  hostId: string; // 방장 socket id
  players: Player[];
  game?: GameState;
}

/** 클라이언트로 내려보내는 방 상태 스냅샷 */
export interface RoomState {
  code: string;
  hostId: string;
  players: Player[];
}

export interface CreateRoomPayload {
  nickname: string;
}

export interface JoinRoomPayload {
  code: string;
  nickname: string;
}

export interface SetWordPayload {
  word: string;
}
