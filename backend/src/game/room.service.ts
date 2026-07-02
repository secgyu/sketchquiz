import { Injectable } from '@nestjs/common';
import type {
  CreateRoomPayload,
  PublicRoomSummary,
  Room,
  ServerPlayer,
} from './game.types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O/1/I 제외

// 방 옵션 기본값과 허용 범위 (서버가 진실의 기준. 클라이언트 값은 신뢰하지 않는다)
const ROOM_DEFAULTS = { maxPlayers: 8, totalRounds: 3, roundSeconds: 80 };
const ROOM_LIMITS = {
  maxPlayers: [2, 8],
  totalRounds: [1, 10],
  roundSeconds: [30, 180],
} as const;
const MAX_NAME_LENGTH = 20;

/** 숫자를 정수로 바꾸고 [min, max] 범위로 보정한다. 잘못된 값은 min으로 떨어진다. */
function clampInt(
  value: unknown,
  [min, max]: readonly [number, number],
): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * 방 상태를 서버 메모리(Map)로 관리한다. DB 없음.
 * 방장/플레이어 목록만 다루고, 게임 진행 로직은 이후 단계에서 확장한다.
 */
@Injectable()
export class RoomService {
  private readonly rooms = new Map<string, Room>();

  createRoom(
    hostId: string,
    userId: string,
    nickname: string,
    options: CreateRoomPayload = {},
  ): Room {
    const code = this.generateUniqueCode();
    const name =
      (options.name ?? '').trim().slice(0, MAX_NAME_LENGTH) ||
      `${nickname}님의 방`;
    const room: Room = {
      code,
      hostId,
      name,
      isPublic: options.isPublic ?? true,
      maxPlayers: clampInt(
        options.maxPlayers ?? ROOM_DEFAULTS.maxPlayers,
        ROOM_LIMITS.maxPlayers,
      ),
      totalRounds: clampInt(
        options.totalRounds ?? ROOM_DEFAULTS.totalRounds,
        ROOM_LIMITS.totalRounds,
      ),
      roundSeconds: clampInt(
        options.roundSeconds ?? ROOM_DEFAULTS.roundSeconds,
        ROOM_LIMITS.roundSeconds,
      ),
      createdAt: Date.now(),
      players: [{ id: hostId, userId, nickname, score: 0, connected: true }],
    };
    this.rooms.set(code, room);
    return room;
  }

  /**
   * 대기 중인 방의 설정을 부분 갱신한다(넘어온 필드만).
   * 최대 인원은 현재 인원보다 적게 줄일 수 없다. 없는 방이면 예외.
   */
  updateRoom(code: string, options: CreateRoomPayload): Room {
    const room = this.rooms.get(code);
    if (!room) throw new Error('존재하지 않는 방이에요.');

    if (options.name !== undefined) {
      const name = options.name.trim().slice(0, MAX_NAME_LENGTH);
      if (name) room.name = name; // 빈 이름은 기존 값 유지
    }
    if (options.isPublic !== undefined) room.isPublic = options.isPublic;
    if (options.maxPlayers !== undefined) {
      const min = Math.max(ROOM_LIMITS.maxPlayers[0], room.players.length);
      room.maxPlayers = clampInt(options.maxPlayers, [
        min,
        ROOM_LIMITS.maxPlayers[1],
      ] as const);
    }
    if (options.totalRounds !== undefined) {
      room.totalRounds = clampInt(options.totalRounds, ROOM_LIMITS.totalRounds);
    }
    if (options.roundSeconds !== undefined) {
      room.roundSeconds = clampInt(
        options.roundSeconds,
        ROOM_LIMITS.roundSeconds,
      );
    }
    return room;
  }

  /** 공개방 목록. 비공개방은 제외하고, 진행중/대기중 상태를 함께 담는다. */
  listPublicRooms(): PublicRoomSummary[] {
    return [...this.rooms.values()]
      .filter((room) => room.isPublic)
      .map((room) => ({
        code: room.code,
        name: room.name,
        host: room.players.find((p) => p.id === room.hostId)?.nickname ?? '',
        count: room.players.length,
        max: room.maxPlayers,
        status: room.game ? 'playing' : 'waiting',
        round: room.totalRounds,
        createdAt: room.createdAt,
      }));
  }

  /**
   * 존재하지 않는 방이면 예외를 던진다. 이미 들어와 있으면 중복 추가하지 않는다.
   * 정원이 가득 찬 방에는 새로 입장할 수 없다.
   */
  joinRoom(
    code: string,
    playerId: string,
    userId: string,
    nickname: string,
  ): Room {
    const room = this.rooms.get(code);
    if (!room) throw new Error('존재하지 않는 방이에요.');
    if (!room.players.some((p) => p.id === playerId)) {
      if (room.players.length >= room.maxPlayers) {
        throw new Error('방이 가득 찼어요.');
      }
      room.players.push({
        id: playerId,
        userId,
        nickname,
        score: 0,
        connected: true,
      });
    }
    return room;
  }

  /**
   * 재접속: 같은 방에 userId가 이미 있으면 socket id 참조를 새 것으로 갈아끼운다.
   * 기존 점수·턴 순서·방장 권한을 그대로 유지한 채 새 소켓에 다시 연결한다.
   * 해당 userId 플레이어가 없으면 null(=신규 입장으로 처리하라는 뜻).
   */
  rebindPlayer(
    room: Room,
    userId: string,
    newSocketId: string,
  ): ServerPlayer | null {
    const player = room.players.find((p) => p.userId === userId);
    if (!player) return null;

    const oldId = player.id;
    player.id = newSocketId;
    player.connected = true;
    if (room.hostId === oldId) room.hostId = newSocketId;

    const game = room.game;
    if (game) {
      if (game.drawerId === oldId) game.drawerId = newSocketId;
      game.order = game.order.map((id) => (id === oldId ? newSocketId : id));
      game.correctGuessers = game.correctGuessers.map((id) =>
        id === oldId ? newSocketId : id,
      );
    }
    return player;
  }

  /** 연결이 끊긴 플레이어를 곧바로 지우지 않고 '접속 끊김'으로만 표시한다(재접속 유예). */
  markDisconnected(socketId: string): Room | null {
    const room = this.getRoomByPlayer(socketId);
    const player = room?.players.find((p) => p.id === socketId);
    if (player) player.connected = false;
    return room ?? null;
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
