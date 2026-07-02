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
  TURN_END_SECONDS,
  WORD_SELECT_SECONDS,
} from './game.service';
import type {
  ChatMessagePayload,
  CreateRoomPayload,
  DrawStroke,
  JoinRoomPayload,
  PublicRoomSummary,
  Room,
  RoomState,
  SetWordPayload,
  SocketData,
} from './game.types';
import { RoomService } from './room.service';

const LOBBY_ROOM = 'lobby'; // 공개방 목록을 구독하는 소켓들이 모이는 가상 방

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
    const nickname = (client.data as SocketData).username;
    const wasDrawer =
      this.roomService.getRoomByPlayer(client.id)?.game?.drawerId === client.id;
    const room = this.roomService.leaveRoom(client.id);
    this.emitLobbyUpdate(); // 방 삭제·인원 변동 모두 반영 (room이 null이어도 안전)
    if (!room) return;

    if (nickname) this.server.to(room.code).emit('player:left', { nickname });
    this.server.to(room.code).emit('room:state', this.toState(room));
    // 진행 중인데 출제자가 나갔으면 턴을 마무리하고 다음으로 넘긴다.
    if (wasDrawer && room.game) this.endTurn(room.code);
  }

  @SubscribeMessage('lobby:join')
  handleLobbyJoin(@ConnectedSocket() client: Socket): PublicRoomSummary[] {
    void client.join(LOBBY_ROOM);
    return this.roomService.listPublicRooms(); // 최초 목록은 ack로 전달
  }

  @SubscribeMessage('lobby:leave')
  handleLobbyLeave(@ConnectedSocket() client: Socket) {
    void client.leave(LOBBY_ROOM);
  }

  @SubscribeMessage('room:create')
  handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() options: CreateRoomPayload = {},
  ): RoomState {
    const room = this.roomService.createRoom(
      client.id,
      this.username(client),
      options,
    );
    void client.join(room.code);
    this.emitLobbyUpdate(); // 공개방이면 목록에 즉시 노출
    // 반환값은 클라이언트가 넘긴 ack 콜백으로 전달된다(요청-응답 1:1).
    return this.toState(room);
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
      this.emitLobbyUpdate(); // 인원 변동 반영
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '방 입장에 실패했어요.';
      client.emit('room:error', { message });
    }
  }

  @SubscribeMessage('room:update')
  handleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() options: CreateRoomPayload = {},
  ) {
    const room = this.roomService.getRoomByPlayer(client.id);
    if (!room) {
      client.emit('room:error', { message: '방을 찾을 수 없어요.' });
      return;
    }
    if (room.hostId !== client.id) {
      client.emit('room:error', { message: '방장만 설정을 바꿀 수 있어요.' });
      return;
    }
    if (room.game) {
      client.emit('room:error', {
        message: '게임 중에는 설정을 바꿀 수 없어요.',
      });
      return;
    }
    this.roomService.updateRoom(room.code, options);
    this.server.to(room.code).emit('room:state', this.toState(room));
    this.emitLobbyUpdate();
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
    this.emitLobbyUpdate(); // 대기중 → 게임중 상태 반영
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
    // 제시된 3지선다 후보 중에서만 고를 수 있다(임의 단어 방지).
    if (!trimmed || !room.game.choices.includes(trimmed)) {
      client.emit('room:error', { message: '제시된 단어 중에서 골라 주세요.' });
      return;
    }

    room.game.word = trimmed;
    this.server.to(room.code).emit('game:turn-start', {
      wordLength: trimmed.length,
      duration: room.roundSeconds,
    });
    this.setTurnTimer(room.code, room.roundSeconds);
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
      if (result.allGuessed) this.endTurn(room.code);
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
    // 후보 단어는 출제자에게만 보낸다(추측자에게 노출되면 안 됨).
    this.server.to(game.drawerId).emit('game:word-choices', {
      choices: game.choices,
      duration: WORD_SELECT_SECONDS,
    });

    // 출제자가 제한시간 내에 단어를 정하지 않으면 턴을 건너뛴다.
    this.setTurnTimer(room.code, WORD_SELECT_SECONDS);
  }

  /**
   * 턴이 끝났을 때(모두 정답·시간초과·출제자 이탈) 정답을 공개하고 잠시 뒤 다음 턴으로 넘긴다.
   * 단어가 정해지지 않은 턴(출제자 미선정)은 공개할 게 없어 곧바로 넘긴다.
   */
  private endTurn(code: string) {
    const room = this.roomService.getRoom(code);
    if (!room?.game) {
      this.clearTurnTimer(code);
      return;
    }
    const game = room.game;
    this.clearTurnTimer(code);

    if (!game.word) {
      this.advanceToNext(code);
      return;
    }

    const correctGuessers = game.correctGuessers
      .map((id) => room.players.find((p) => p.id === id)?.nickname)
      .filter((nickname): nickname is string => !!nickname);

    this.server.to(code).emit('game:turn-end', {
      word: game.word,
      correctGuessers,
      players: room.players.map((p) => ({
        nickname: p.nickname,
        score: p.score,
      })),
      duration: TURN_END_SECONDS,
    });

    this.turnTimers.set(
      code,
      setTimeout(() => this.advanceToNext(code), TURN_END_SECONDS * 1000),
    );
  }

  private advanceToNext(code: string) {
    const room = this.roomService.getRoom(code);
    if (!room?.game) {
      this.clearTurnTimer(code);
      return;
    }
    const game = this.gameService.advance(room);
    if (game.status === 'ended') {
      this.clearTurnTimer(code);
      room.game = undefined;
      this.emitLobbyUpdate(); // 게임중 → 대기중 상태 반영
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
      setTimeout(() => this.endTurn(code), seconds * 1000),
    );
  }

  private clearTurnTimer(code: string) {
    const timer = this.turnTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(code);
    }
  }

  /** 로비를 구독 중인 소켓들에게 최신 공개방 목록을 브로드캐스트한다. */
  private emitLobbyUpdate() {
    this.server
      .to(LOBBY_ROOM)
      .emit('room:list', this.roomService.listPublicRooms());
  }

  private toState(room: Room): RoomState {
    return {
      code: room.code,
      hostId: room.hostId,
      name: room.name,
      isPublic: room.isPublic,
      maxPlayers: room.maxPlayers,
      totalRounds: room.totalRounds,
      roundSeconds: room.roundSeconds,
      status: room.game ? 'playing' : 'waiting',
      players: room.players,
    };
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
