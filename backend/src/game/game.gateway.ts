import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
import type { JwtPayload } from '../auth/jwt.strategy';
import {
  GameService,
  ROUND_SECONDS,
  WORD_SELECT_SECONDS,
} from './game.service';
import type {
  ChatMessagePayload,
  DrawStroke,
  JoinRoomPayload,
  Room,
  RoomState,
  SetWordPayload,
  SocketData,
} from './game.types';
import { RoomService } from './room.service';

/**
 * 게임 실시간 통신 게이트웨이.
 * 소켓 이벤트를 받아 RoomService/GameService를 호출하고, 방 전체에 상태를 브로드캐스트한다.
 * 턴 제한시간은 서버 setTimeout으로 관리한다(서버가 진행의 기준).
 */
@WebSocketGateway({
  cors: { origin: 'http://localhost:5173' },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);
  private readonly turnTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly jwt: JwtService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const payload = this.jwt.verify<JwtPayload>(this.extractToken(client));
      const data = client.data as SocketData;
      data.userId = payload.sub;
      data.username = payload.username;
      this.logger.log(`연결됨: ${payload.username} (${client.id})`);
    } catch {
      client.emit('auth:error', {
        message: '인증에 실패했어요. 다시 로그인해 주세요.',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`연결 끊김: ${client.id}`);
    const wasDrawer =
      this.roomService.getRoomByPlayer(client.id)?.game?.drawerId === client.id;
    const room = this.roomService.leaveRoom(client.id);
    if (!room) return;

    this.server.to(room.code).emit('room:state', this.toState(room));
    // 진행 중인데 출제자가 나갔으면 다음 턴으로 넘긴다.
    if (wasDrawer && room.game) this.advanceTurn(room.code);
  }

  @SubscribeMessage('room:create')
  handleCreate(@ConnectedSocket() client: Socket) {
    const room = this.roomService.createRoom(client.id, this.username(client));
    void client.join(room.code);
    client.emit('room:state', this.toState(room));
  }

  @SubscribeMessage('room:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() { code }: JoinRoomPayload,
  ) {
    try {
      const room = this.roomService.joinRoom(
        code.toUpperCase(),
        client.id,
        this.username(client),
      );
      void client.join(room.code);
      this.server.to(room.code).emit('room:state', this.toState(room));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '방 입장에 실패했어요.';
      client.emit('room:error', { message });
    }
  }

  @SubscribeMessage('game:start')
  handleStart(@ConnectedSocket() client: Socket) {
    const room = this.roomService.getRoomByPlayer(client.id);
    if (!room) {
      client.emit('room:error', { message: '방을 찾을 수 없어요.' });
      return;
    }
    if (room.hostId !== client.id) {
      client.emit('room:error', { message: '방장만 게임을 시작할 수 있어요.' });
      return;
    }
    if (room.game) {
      client.emit('room:error', { message: '이미 게임이 진행 중이에요.' });
      return;
    }
    this.gameService.start(room);
    this.announceTurn(room);
  }

  @SubscribeMessage('game:set-word')
  handleSetWord(
    @ConnectedSocket() client: Socket,
    @MessageBody() { word }: SetWordPayload,
  ) {
    const room = this.roomService.getRoomByPlayer(client.id);
    if (!room?.game) return;
    if (room.game.drawerId !== client.id) {
      client.emit('room:error', { message: '출제자만 단어를 정할 수 있어요.' });
      return;
    }
    if (room.game.word) return; // 이미 정한 턴

    const trimmed = word?.trim();
    if (!trimmed) {
      client.emit('room:error', { message: '단어를 입력해 주세요.' });
      return;
    }

    room.game.word = trimmed;
    this.server.to(room.code).emit('game:turn-start', {
      wordLength: trimmed.length,
      duration: ROUND_SECONDS,
    });
    this.setTurnTimer(room.code, ROUND_SECONDS);
  }

  @SubscribeMessage('draw:stroke')
  handleDrawStroke(
    @ConnectedSocket() client: Socket,
    @MessageBody() stroke: DrawStroke,
  ) {
    const room = this.roomService.getRoomByPlayer(client.id);
    if (!room?.game || room.game.drawerId !== client.id) return; // 출제자만 그릴 수 있다
    client.to(room.code).emit('draw:stroke', stroke);
  }

  @SubscribeMessage('draw:clear')
  handleDrawClear(@ConnectedSocket() client: Socket) {
    const room = this.roomService.getRoomByPlayer(client.id);
    if (!room?.game || room.game.drawerId !== client.id) return;
    client.to(room.code).emit('draw:clear');
  }

  @SubscribeMessage('chat:message')
  handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() { text }: ChatMessagePayload,
  ) {
    const room = this.roomService.getRoomByPlayer(client.id);
    const player = room?.players.find((p) => p.id === client.id);
    if (!room || !player) return;

    const result = this.gameService.checkGuess(room, client.id, text);
    if (result.status === 'already') return; // 정답 재입력은 무시 (단어 노출 방지)

    if (result.status === 'correct') {
      this.server.to(room.code).emit('chat:correct', {
        playerId: player.id,
        nickname: player.nickname,
      });
      this.server.to(room.code).emit('room:state', this.toState(room));
      if (result.allGuessed) this.advanceTurn(room.code);
      return;
    }

    this.server.to(room.code).emit('chat:message', {
      playerId: player.id,
      nickname: player.nickname,
      text: text.trim(),
    });
  }

  /** 턴 시작을 방에 알리고 출제자에게 단어 입력을 요청한다. 단어 입력 제한시간을 건다. */
  private announceTurn(room: Room) {
    const game = room.game;
    if (!game) return;

    this.server.to(room.code).emit('game:turn', {
      round: game.round,
      totalRounds: game.totalRounds,
      drawerId: game.drawerId,
      selectDuration: WORD_SELECT_SECONDS,
    });
    this.server.to(game.drawerId).emit('game:word-request', {});

    // 출제자가 제한시간 내에 단어를 정하지 않으면 턴을 건너뛴다.
    this.setTurnTimer(room.code, WORD_SELECT_SECONDS);
  }

  private advanceTurn(code: string) {
    const room = this.roomService.getRoom(code);
    if (!room?.game) {
      this.clearTurnTimer(code);
      return;
    }
    const game = this.gameService.advance(room);
    if (game.status === 'ended') {
      this.clearTurnTimer(code);
      room.game = undefined;
      const ranking = [...room.players].sort((a, b) => b.score - a.score);
      this.server.to(code).emit('game:ended', { ranking });
      return;
    }
    this.announceTurn(room);
  }

  private setTurnTimer(code: string, seconds: number) {
    this.clearTurnTimer(code);
    this.turnTimers.set(
      code,
      setTimeout(() => this.advanceTurn(code), seconds * 1000),
    );
  }

  private clearTurnTimer(code: string) {
    const timer = this.turnTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(code);
    }
  }

  private toState(room: Room): RoomState {
    return { code: room.code, hostId: room.hostId, players: room.players };
  }

  private username(client: Socket): string {
    return (client.data as SocketData).username;
  }

  /** 소켓 핸드셰이크에서 JWT를 꺼낸다 (auth.token 우선, Authorization 헤더 대체). */
  private extractToken(client: Socket): string {
    const auth = client.handshake.auth as { token?: unknown };
    if (typeof auth.token === 'string' && auth.token) return auth.token;

    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);

    throw new Error('토큰 없음');
  }
}
