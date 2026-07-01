import { Injectable } from '@nestjs/common';
import type { Room } from './game.types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O/1/I 제외

/**
 * 방 상태를 서버 메모리(Map)로 관리한다. DB 없음.
 * 방장/플레이어 목록만 다루고, 게임 진행 로직은 이후 단계에서 확장한다.
 */
@Injectable()
export class RoomService {
  private readonly rooms = new Map<string, Room>();

  createRoom(hostId: string, nickname: string): Room {
    const code = this.generateUniqueCode();
    const room: Room = {
      code,
      hostId,
      players: [{ id: hostId, nickname, score: 0 }],
    };
    this.rooms.set(code, room);
    return room;
  }

  /** 존재하지 않는 방이면 예외를 던진다. 이미 들어와 있으면 중복 추가하지 않는다. */
  joinRoom(code: string, playerId: string, nickname: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new Error('존재하지 않는 방이에요.');
    if (!room.players.some((p) => p.id === playerId)) {
      room.players.push({ id: playerId, nickname, score: 0 });
    }
    return room;
  }

  /**
   * 플레이어를 방에서 제거한다.
   * - 방이 비면 삭제하고 null 반환
   * - 방장이 나가면 남은 첫 사람에게 방장 위임
   * - 해당 플레이어가 어느 방에도 없으면 null 반환
   */
  leaveRoom(playerId: string): Room | null {
    for (const room of this.rooms.values()) {
      const index = room.players.findIndex((p) => p.id === playerId);
      if (index === -1) continue;

      room.players.splice(index, 1);
      if (room.players.length === 0) {
        this.rooms.delete(room.code);
        return null;
      }
      if (room.hostId === playerId) {
        room.hostId = room.players[0].id;
      }
      return room;
    }
    return null;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getRoomByPlayer(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.id === playerId)) return room;
    }
    return undefined;
  }

  private generateUniqueCode(): string {
    let code: string;
    do {
      code = Array.from(
        { length: 4 },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }
}
