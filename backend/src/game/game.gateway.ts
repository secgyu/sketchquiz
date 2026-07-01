import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * 게임 실시간 통신 게이트웨이.
 * 지금은 연결/해제 로깅만 담당한다. 방/게임 로직은 이후 단계에서 추가한다.
 */
@WebSocketGateway({
  cors: { origin: 'http://localhost:5173' },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`연결됨: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`연결 끊김: ${client.id}`);
  }
}
