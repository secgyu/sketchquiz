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
  Player,
  PublicRoomSummary,
  Room,
  RoomState,
  SetWordPayload,
  SocketData,
} from './game.types';
import type { ClientToServerEvents, ServerToClientEvents } from './protocol';
import { RoomService } from './room.service';

const LOBBY_ROOM = 'lobby'; // 공개방 목록을 구독하는 소켓들이 모이는 가상 방
const RECONNECT_GRACE_MS = 60_000; // 게임 중 연결이 끊겨도 이 시간 안에 돌아오면 자리를 지켜준다
const MAX_STROKES = 5000; // 재접속 복원용 획 버퍼 상한 (한 턴 기준, 메모리 폭주 방지)

// 실시간 통신 계약(protocol.ts)을 소켓 제네릭에 입혀 emit 페이로드를 컴파일 타임에 검증한다.
type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

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
  server: IoServer;

  private readonly logger = new Logger(GameGateway.name);
  private readonly turnTimers = new Map<string, NodeJS.Timeout>();
  // 재접속 유예 타이머 (userId → 제거 예약). 돌아오면 취소한다.
  private readonly removalTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly jwt: JwtService,
  ) {}

  handleConnection(client: IoSocket) {
    try {
      const payload = this.jwt.verify<JwtPayload>(this.extractToken(client));
      const data = client.data as SocketData;
      data.userId = payload.sub;
      data.username = payload.username;
      data.avatar = this.extractAvatar(client);
      this.logger.log(`연결됨: ${payload.username} (${client.id})`);
    } catch {
      client.emit('auth:error', {
        message: '인증에 실패했어요. 다시 로그인해 주세요.',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: IoSocket) {
    this.logger.log(`연결 끊김: ${client.id}`);
    const socketId = client.id;
    const nickname = this.username(client);
    const userId = this.userId(client);
    const room = this.roomService.getRoomByPlayer(socketId);
    if (!room) {
      this.emitLobbyUpdate();
      return;
    }

    if (room.game) {
      // 게임 중: 즉시 내보내지 않고 '접속 끊김'으로만 표시하고 재접속을 기다린다.
      // 출제자가 끊겨도 턴을 넘기지 않는다 — 새로고침이면 곧 돌아와 game:sync로 이어서 그린다.
      // 끝내 안 돌아오면 유예 만료(scheduleRemoval) 또는 턴 타이머가 턴을 마무리한다.
      this.roomService.markDisconnected(socketId);
      this.server.to(room.code).emit('room:state', this.toState(room));
      this.scheduleRemoval(room.code, socketId, userId, nickname);
    } else {
      // 대기실: 기존처럼 즉시 퇴장 처리
      const left = this.roomService.leaveRoom(socketId);
      if (left) {
        if (nickname)
          this.server.to(left.code).emit('player:left', { nickname });
        this.server.to(left.code).emit('room:state', this.toState(left));
      }
    }
    this.emitLobbyUpdate();
  }

  /** 재접속 유예가 끝나면 실제로 방에서 제거한다(돌아왔거나 사라졌으면 무시). */
  private scheduleRemoval(
    code: string,
    socketId: string,
    userId: string,
    nickname: string,
  ) {
    this.cancelRemoval(userId);
    this.removalTimers.set(
      userId,
      setTimeout(() => {
        this.removalTimers.delete(userId);
        const room = this.roomService.getRoom(code);
        const player = room?.players.find((p) => p.id === socketId);
        if (!player || player.connected) return; // 이미 재접속했다
        const wasDrawer = room?.game?.drawerId === socketId;
        const left = this.roomService.leaveRoom(socketId);
        this.emitLobbyUpdate();
        if (!left) return;
        if (nickname)
          this.server.to(left.code).emit('player:left', { nickname });
        this.server.to(left.code).emit('room:state', this.toState(left));
        if (wasDrawer && left.game) this.endTurn(left.code);
      }, RECONNECT_GRACE_MS),
    );
  }

  private cancelRemoval(userId: string) {
    const timer = this.removalTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.removalTimers.delete(userId);
    }
  }

  @SubscribeMessage('lobby:join')
  handleLobbyJoin(@ConnectedSocket() client: IoSocket): PublicRoomSummary[] {
    void client.join(LOBBY_ROOM);
    return this.roomService.listPublicRooms(); // 최초 목록은 ack로 전달
  }

  @SubscribeMessage('lobby:leave')
  handleLobbyLeave(@ConnectedSocket() client: IoSocket) {
    void client.leave(LOBBY_ROOM);
  }

  @SubscribeMessage('room:create')
  handleCreate(
    @ConnectedSocket() client: IoSocket,
    @MessageBody() options: CreateRoomPayload = {},
  ): RoomState {
    const room = this.roomService.createRoom(
      client.id,
      this.userId(client),
      this.username(client),
      options,
      this.avatar(client),
    );
    void client.join(room.code);
    this.emitLobbyUpdate(); // 공개방이면 목록에 즉시 노출
    // 반환값은 클라이언트가 넘긴 ack 콜백으로 전달된다(요청-응답 1:1).
    return this.toState(room);
  }

  @SubscribeMessage('room:join')
  handleJoin(
    @ConnectedSocket() client: IoSocket,
    @MessageBody() { code }: JoinRoomPayload,
  ) {
    const upper = code.toUpperCase();
    const userId = this.userId(client);
    const existing = this.roomService.getRoom(upper);

    // 재접속: 같은 방에 내 userId가 이미 있으면 새 소켓으로 갈아끼우고 상태를 복원한다.
    if (existing?.players.some((p) => p.userId === userId)) {
      const rebound = this.roomService.rebindPlayer(
        existing,
        userId,
        client.id,
      );
      if (rebound) rebound.avatar = this.avatar(client); // 재접속 시 최신 아바타 반영
      this.cancelRemoval(userId);
      void client.join(existing.code);
      this.server.to(existing.code).emit('room:state', this.toState(existing));
      this.emitLobbyUpdate();
      if (existing.game) this.sendSync(client, existing);
      return;
    }

    try {
      const room = this.roomService.joinRoom(
        upper,
        client.id,
        userId,
        this.username(client),
        this.avatar(client),
      );
      void client.join(room.code);
      // 진행 중인 방에 들어온 신규 참가자(드롭인): 턴 순서에 편입하고 현재 상태를 스냅샷으로 맞춰준다.
      if (room.game && !room.game.order.includes(client.id)) {
        room.game.order.push(client.id);
      }
      this.server.to(room.code).emit('room:state', this.toState(room));
      if (room.game) this.sendSync(client, room);
      this.emitLobbyUpdate(); // 인원 변동 반영
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '방 입장에 실패했어요.';
      client.emit('room:error', { message });
    }
  }

  /** 재접속한 클라이언트에게 현재 진행 상태 스냅샷을 보내 화면을 복원시킨다. */
  private sendSync(client: IoSocket, room: Room) {
    const game = room.game;
    if (!game) return;
    const isDrawer = game.drawerId === client.id;
    const remainingSec = Math.max(
      0,
      Math.ceil((game.deadline - Date.now()) / 1000),
    );
    client.emit('game:sync', {
      round: game.round,
      totalRounds: game.totalRounds,
      drawerId: game.drawerId,
      phase: game.phase,
      wordLength: game.word.length,
      remainingSec,
      correctIds: game.correctGuessers,
      strokes: game.strokes, // 이미 그려진 획을 함께 보내 캔버스를 복원한다
      // 제시어/후보는 본인이 출제자일 때만 노출한다.
      ...(isDrawer && game.word ? { word: game.word } : {}),
      ...(isDrawer && game.phase === 'selecting'
        ? { choices: game.choices }
        : {}),
    });
  }

  @SubscribeMessage('room:update')
  handleUpdate(
    @ConnectedSocket() client: IoSocket,
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
  handleStart(@ConnectedSocket() client: IoSocket) {
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
    if (room.players.length < 2) {
      client.emit('room:error', {
        message: '2명 이상이어야 게임을 시작할 수 있어요.',
      });
      return;
    }
    this.gameService.start(room);
    this.emitLobbyUpdate(); // 대기중 → 게임중 상태 반영
    this.announceTurn(room);
  }

  @SubscribeMessage('game:set-word')
  handleSetWord(
    @ConnectedSocket() client: IoSocket,
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
    room.game.phase = 'drawing';
    room.game.deadline = Date.now() + room.roundSeconds * 1000;
    this.server.to(room.code).emit('game:turn-start', {
      wordLength: trimmed.length,
      duration: room.roundSeconds,
    });
    this.setTurnTimer(room.code, room.roundSeconds);
  }

  @SubscribeMessage('draw:stroke')
  handleDrawStroke(
    @ConnectedSocket() client: IoSocket,
    @MessageBody() stroke: DrawStroke,
  ) {
    const room = this.roomService.getRoomByPlayer(client.id);
    if (!room?.game || room.game.drawerId !== client.id) return; // 출제자만 그릴 수 있다
    // 재접속 복원을 위해 현재 턴의 획을 쌓아 둔다.
    // ponytail: 한 턴 내 상한(MAX_STROKES). 넘으면 이후 획은 버퍼에 안 담겨 재접속 시 뒷부분만 누락(그리기 자체는 정상).
    if (room.game.strokes.length < MAX_STROKES) room.game.strokes.push(stroke);
    client.to(room.code).emit('draw:stroke', stroke);
  }

  @SubscribeMessage('draw:clear')
  handleDrawClear(@ConnectedSocket() client: IoSocket) {
    const room = this.roomService.getRoomByPlayer(client.id);
    if (!room?.game || room.game.drawerId !== client.id) return;
    room.game.strokes = []; // 캔버스를 비웠으니 복원 버퍼도 비운다
    client.to(room.code).emit('draw:clear');
  }

  @SubscribeMessage('draw:undo')
  handleDrawUndo(@ConnectedSocket() client: IoSocket) {
    const room = this.roomService.getRoomByPlayer(client.id);
    if (!room?.game || room.game.drawerId !== client.id) return;
    const strokes = room.game.strokes;
    // 마지막 '드래그 시작' 지점을 찾아 그 이후를 통째로 잘라낸다(한 획 되돌리기).
    let cut = -1;
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (strokes[i].start) {
        cut = i;
        break;
      }
    }
    room.game.strokes = cut >= 0 ? strokes.slice(0, cut) : [];
    // 버퍼가 진실의 원천 → 방 전체(출제자 포함)가 지우고 남은 획으로 다시 그린다.
    this.server.to(room.code).emit('draw:strokes', room.game.strokes);
  }

  @SubscribeMessage('chat:message')
  handleChat(
    @ConnectedSocket() client: IoSocket,
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

    game.phase = 'selecting';
    game.deadline = Date.now() + WORD_SELECT_SECONDS * 1000;
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
      const ranking = this.publicPlayers(room).sort(
        (a, b) => b.score - a.score,
      );
      this.server.to(code).emit('game:ended', { ranking });
      return;
    }
    // 나갔거나 접속이 끊긴 플레이어의 턴은 건너뛴다(아무도 못 그리는 죽은 턴 방지).
    const drawer = room.players.find((p) => p.id === game.drawerId);
    if (!drawer || !drawer.connected) {
      this.advanceToNext(code);
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
      players: this.publicPlayers(room),
    };
  }

  /** 클라이언트로 내보낼 때 서버 비밀(userId)을 제거한 플레이어 목록. */
  private publicPlayers(room: Room): Player[] {
    return room.players.map(({ id, nickname, score, connected, avatar }) => ({
      id,
      nickname,
      score,
      connected,
      avatar,
    }));
  }

  private username(client: IoSocket): string {
    return (client.data as SocketData).username;
  }

  private userId(client: IoSocket): string {
    return (client.data as SocketData).userId;
  }

  private avatar(client: IoSocket): string {
    return (client.data as SocketData).avatar ?? '';
  }

  /** 핸드셰이크에서 이모지 아바타를 꺼내 상한 길이로 자른다(신뢰 경계 방어). */
  private extractAvatar(client: IoSocket): string {
    const auth = client.handshake.auth as { avatar?: unknown };
    if (typeof auth.avatar !== 'string') return '';
    return [...auth.avatar].slice(0, 4).join(''); // 이모지 1개(다중 코드포인트) 정도만 허용
  }

  /** 소켓 핸드셰이크에서 JWT를 꺼낸다 (auth.token 우선, Authorization 헤더 대체). */
  private extractToken(client: IoSocket): string {
    const auth = client.handshake.auth as { token?: unknown };
    if (typeof auth.token === 'string' && auth.token) return auth.token;

    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);

    throw new Error('토큰 없음');
  }
}
