import type { Player, Room, RoomState } from './game.types';

/** 클라이언트로 내보낼 때 서버 비밀(userId)을 제거한 플레이어 목록. */
export function toPublicPlayers(room: Room): Player[] {
  return room.players.map(({ id, nickname, score, connected, avatar }) => ({
    id,
    nickname,
    score,
    connected,
    avatar,
  }));
}

/** 방을 클라이언트 표시용 상태(RoomState)로 변환한다. */
export function toRoomState(room: Room): RoomState {
  return {
    code: room.code,
    hostId: room.hostId,
    name: room.name,
    isPublic: room.isPublic,
    maxPlayers: room.maxPlayers,
    totalRounds: room.totalRounds,
    roundSeconds: room.roundSeconds,
    status: room.game ? 'playing' : 'waiting',
    players: toPublicPlayers(room),
  };
}
