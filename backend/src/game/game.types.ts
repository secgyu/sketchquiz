export interface Player {
  id: string; // socket id
  nickname: string;
  score: number;
}

export interface Room {
  code: string;
  hostId: string; // 방장 socket id
  players: Player[];
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
