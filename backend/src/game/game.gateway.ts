import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  Room,
  RoomState,
} from './game.types';
import { RoomService } from './room.service';

/**
 * 게임 실시간 통신 게이트웨이.
 * 소켓 이벤트만 받아 RoomService를 호출하고, 결과 방 상태를 방 전체에 브로드캐스트한다.
 */
@WebSocketGateway({
  cors: { origin: 'http://localhost:5173' },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(private readonly roomService: RoomService) {}

  handleConnection(client: Socket) {
    this.logger.log(`연결됨: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`연결 끊김: ${client.id}`);
    const room = this.roomService.leaveRoom(client.id);
    if (room) {
      this.server.to(room.code).emit('room:state', this.toState(room));
    }
  }

  @SubscribeMessage('room:create')
  handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() { nickname }: CreateRoomPayload,
  ) {
    const room = this.roomService.createRoom(client.id, nickname);
    void client.join(room.code);
    client.emit('room:state', this.toState(room));
  }

  @SubscribeMessage('room:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() { code, nickname }: JoinRoomPayload,
  ) {
    try {
      const room = this.roomService.joinRoom(
        code.toUpperCase(),
        client.id,
        nickname,
      );
      void client.join(room.code);
      this.server.to(room.code).emit('room:state', this.toState(room));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '방 입장에 실패했어요.';
      client.emit('room:error', { message });
    }
  }

  private toState(room: Room): RoomState {
    return { code: room.code, hostId: room.hostId, players: room.players };
  }
}
