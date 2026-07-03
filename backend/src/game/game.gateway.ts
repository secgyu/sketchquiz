import { Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import type { JwtPayload } from '../auth/jwt.strategy';
import { GameService } from './game.service';
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
import type { ClientToServerEvents, ServerToClientEvents } from './protocol';
import { ReconnectManager } from './reconnect.manager';
import { RoomPersistenceService } from './room-persistence.service';
import { LOBBY_ROOM, RoomBroadcaster, type IoServer } from './room.broadcaster';
import { toRoomState } from './room.mapper';
import { RoomService } from './room.service';
import { TurnManager } from './turn.manager';

const MAX_STROKES = 5000; // 재접속 복원용 획 버퍼 상한 (한 턴 기준, 메모리 폭주 방지)
const MAX_CHAT_LENGTH = 200; // 채팅 한 줄 최대 길이 (도배·과대 페이로드 방어)

type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * 게임 실시간 통신 게이트웨이(얇은 어댑터).
 * 소켓 이벤트를 파싱해 RoomService/GameService·TurnManager·ReconnectManager로 위임하고,
 * 공통 브로드캐스트는 RoomBroadcaster를 통한다.
 */
@WebSocketGateway({
  cors: { origin: 'http://localhost:5173' },
})
export class GameGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly jwt: JwtService,
    private readonly persistence: RoomPersistenceService,
    private readonly bc: RoomBroadcaster,
    private readonly turns: TurnManager,
    private readonly reconnect: ReconnectManager,
  ) {}

  /** 소켓 서버가 준비되면 브로드캐스터에 붙인다(게이트웨이·매니저가 같은 서버를 공유). */
  afterInit(server: IoServer): void {
    this.bc.attach(server);
  }

  /**
   * 서버 부팅 시: 저장돼 있던 방을 복원하고 타이머를 다시 건다.
   * 재시작 직후엔 붙어있는 소켓이 없으므로 모든 플레이어를 '끊김'으로 두고 재접속 유예를 건다.
   * 그 뒤 주기 스냅샷을 시작한다.
   */
  async onModuleInit() {
    try {
      const rooms = await this.persistence.loadAll();
      for (const room of rooms) {
        room.players.forEach((p) => (p.connected = false));
      }
      this.roomService.restore(rooms);
      for (const room of rooms) this.rearmRoom(room);
      if (rooms.length) this.logger.log(`재시작 복원: 방 ${rooms.length}개`);
    } catch (err) {
      this.logger.error('방 상태 복원 실패', err as Error);
    }
    this.persistence.startSnapshots();
  }

  /** 복원된 방 하나의 진행 타이머·재접속 유예를 다시 건다. */
  private rearmRoom(room: Room) {
    this.turns.rearm(room);
    // 재시작 직후 전원이 끊긴 상태 → 각자에게 재접속 유예를 건다(안 돌아오면 정리).
    for (const player of room.players) {
      this.reconnect.schedule(
        room.code,
        player.id,
        player.userId,
        player.nickname,
      );
    }
  }

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
      this.bc.lobby();
      return;
    }

    if (room.game) {
      // 게임 중: 즉시 내보내지 않고 '접속 끊김'으로만 표시하고 재접속을 기다린다.
      // 출제자가 끊겨도 턴을 넘기지 않는다 — 새로고침이면 곧 돌아와 game:sync로 이어서 그린다.
      // 끝내 안 돌아오면 유예 만료 또는 턴 타이머가 턴을 마무리한다.
      this.roomService.markDisconnected(socketId);
      this.bc.state(room);
      this.reconnect.schedule(room.code, socketId, userId, nickname);
    } else {
      // 대기실: 기존처럼 즉시 퇴장 처리
      const left = this.roomService.leaveRoom(socketId);
      if (left) {
        if (nickname) {
          this.bc.server.to(left.code).emit('player:left', { nickname });
        }
        this.bc.state(left);
      }
    }
    this.bc.lobby();
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
    this.bc.lobby(); // 공개방이면 목록에 즉시 노출
    // 반환값은 클라이언트가 넘긴 ack 콜백으로 전달된다(요청-응답 1:1).
    return toRoomState(room);
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
      this.reconnect.cancel(userId);
      void client.join(existing.code);
      this.bc.state(existing);
      this.bc.lobby();
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
      this.bc.state(room);
      if (room.game) this.sendSync(client, room);
      this.bc.lobby(); // 인원 변동 반영
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
    this.bc.state(room);
    this.bc.lobby();
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
    this.bc.lobby(); // 대기중 → 게임중 상태 반영
    this.turns.announceTurn(room);
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

    this.turns.beginDrawing(room, trimmed);
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
    this.bc.server.to(room.code).emit('draw:strokes', room.game.strokes);
  }

  @SubscribeMessage('chat:message')
  handleChat(
    @ConnectedSocket() client: IoSocket,
    @MessageBody() payload: ChatMessagePayload,
  ) {
    const room = this.roomService.getRoomByPlayer(client.id);
    const player = room?.players.find((p) => p.id === client.id);
    if (!room || !player) return;

    // 신뢰 경계: 클라이언트 페이로드는 믿지 않는다(문자열 강제 + 길이 제한).
    const raw = typeof payload?.text === 'string' ? payload.text : '';
    const text = raw.trim().slice(0, MAX_CHAT_LENGTH);
    if (!text) return;

    const result = this.gameService.checkGuess(room, client.id, text);
    if (result.status === 'already') return; // 정답 재입력은 무시 (단어 노출 방지)

    if (result.status === 'correct') {
      this.bc.server.to(room.code).emit('chat:correct', {
        playerId: player.id,
        nickname: player.nickname,
      });
      this.bc.state(room);
      if (result.allGuessed) this.turns.endTurn(room.code);
      return;
    }

    // 진행 중 제시어가 그대로 담긴 일반 채팅은 막는다(출제자·정답자가 답을 흘리는 것 방지).
    if (
      room.game?.word &&
      text.toLowerCase() === room.game.word.toLowerCase()
    ) {
      return;
    }

    this.bc.server.to(room.code).emit('chat:message', {
      playerId: player.id,
      nickname: player.nickname,
      text,
    });
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
