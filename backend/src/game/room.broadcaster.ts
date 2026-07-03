import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { Room } from './game.types';
import type { ClientToServerEvents, ServerToClientEvents } from './protocol';
import { toRoomState } from './room.mapper';
import { RoomService } from './room.service';

export const LOBBY_ROOM = 'lobby'; // 공개방 목록을 구독하는 소켓들이 모이는 가상 방

// 실시간 통신 계약(protocol.ts)을 소켓 제네릭에 입혀 emit 페이로드를 컴파일 타임에 검증한다.
export type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * 소켓 서버 참조를 한 곳에서 들고, 방/로비로의 공통 브로드캐스트를 담당한다.
 * 게이트웨이와 각 매니저가 같은 서버 인스턴스를 공유하도록 하는 단일 접점.
 */
@Injectable()
export class RoomBroadcaster {
  private srv!: IoServer;

  constructor(private readonly rooms: RoomService) {}

  /** 게이트웨이 초기화(afterInit) 때 실제 소켓 서버를 붙인다. */
  attach(server: IoServer): void {
    this.srv = server;
  }

  /** 임의 이벤트 emit용 원본 서버(특정 이벤트는 게이트웨이/매니저에서 직접 사용). */
  get server(): IoServer {
    return this.srv;
  }

  /** 방 전체에 최신 방 상태를 브로드캐스트한다. */
  state(room: Room): void {
    this.srv.to(room.code).emit('room:state', toRoomState(room));
  }

  /** 로비 구독자에게 최신 공개방 목록을 브로드캐스트한다. */
  lobby(): void {
    this.srv.to(LOBBY_ROOM).emit('room:list', this.rooms.listPublicRooms());
  }
}
