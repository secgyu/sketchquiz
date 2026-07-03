import type { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { GameGateway } from './game.gateway';
import { GameService, TURN_END_SECONDS } from './game.service';
import type { RoomPersistenceService } from './room-persistence.service';
import { RoomService } from './room.service';

// 영속화는 테스트 대상이 아니므로 no-op 스텁으로 주입한다(스냅샷/복원 비활성).
const persistenceStub = {
  loadAll: () => Promise.resolve([]),
  startSnapshots: () => {},
  snapshot: () => Promise.resolve(),
} as unknown as RoomPersistenceService;

interface Emitted {
  room: string;
  event: string;
  payload: unknown;
}

/** server.to(room).emit(event, payload) 호출을 모두 기록하는 가짜 소켓 서버 */
function mockServer(sink: Emitted[]): Server {
  return {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        sink.push({ room, event, payload });
      },
    }),
  } as unknown as Server;
}

function mockClient(id: string): Socket {
  return {
    id,
    data: { userId: id, username: `user-${id}` },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: () => ({ emit: jest.fn() }),
  } as unknown as Socket;
}

describe('GameGateway 턴 종료 연출', () => {
  let gateway: GameGateway;
  let roomService: RoomService;
  let emitted: Emitted[];

  beforeEach(() => {
    jest.useFakeTimers();
    emitted = [];
    roomService = new RoomService();
    gateway = new GameGateway(
      roomService,
      new GameService(),
      {} as JwtService,
      persistenceStub,
    );
    gateway.server = mockServer(emitted);
  });

  afterEach(() => jest.useRealTimers());

  const events = (name: string) => emitted.filter((e) => e.event === name);

  /** 방 생성 → 참가자 입장 → 게임 시작까지 진행한다. */
  function startTwoPlayerGame(host: Socket, guesser: Socket): void {
    gateway.handleCreate(host, {}); // 코드는 ack로만 반환되므로 서비스에서 조회한다.
    const room = roomService.getRoomByPlayer(host.id)!;
    gateway.handleJoin(guesser, { code: room.code });
    gateway.handleStart(host);
  }

  it('정답을 모두 맞히면 turn-end로 단어를 공개하고, 잠시 뒤 다음 턴을 시작한다', () => {
    const host = mockClient('h'); // order[0] → 첫 출제자
    const guesser = mockClient('g');
    startTwoPlayerGame(host, guesser);

    // 제시된 3지선다 후보 중 하나만 고를 수 있다.
    const word = roomService.getRoomByPlayer(host.id)!.game!.choices[0];
    gateway.handleSetWord(host, { word });
    const turnsBefore = events('game:turn').length;

    gateway.handleChat(guesser, { text: word });

    const end = events('game:turn-end');
    expect(end).toHaveLength(1);
    expect(end[0].payload).toMatchObject({
      word,
      correctGuessers: ['user-g'],
    });
    // 아직 다음 턴은 시작되지 않는다(공개 연출 대기 중).
    expect(events('game:turn').length).toBe(turnsBefore);

    jest.advanceTimersByTime(TURN_END_SECONDS * 1000);
    expect(events('game:turn').length).toBe(turnsBefore + 1); // 다음 턴 시작
  });

  it('출제자가 단어를 정하지 않고 시간이 지나면 공개 없이 다음 턴으로 넘어간다', () => {
    const host = mockClient('h');
    const guesser = mockClient('g');
    startTwoPlayerGame(host, guesser);

    const turnsBefore = events('game:turn').length;
    // 단어 선택 제한시간(WORD_SELECT_SECONDS=20s)을 넘긴다.
    jest.advanceTimersByTime(20 * 1000);

    expect(events('game:turn-end')).toHaveLength(0); // 공개할 단어가 없으니 연출 생략
    expect(events('game:turn').length).toBe(turnsBefore + 1); // 곧바로 다음 턴
  });

  it('진행 중인 방에 들어온 참가자는 턴 순서에 편입되고 상태 스냅샷을 받는다', () => {
    const host = mockClient('h');
    const guesser = mockClient('g');
    startTwoPlayerGame(host, guesser);

    const latecomer = mockClient('late');
    const syncSpy = jest.spyOn(latecomer, 'emit');
    const room = roomService.getRoomByPlayer(host.id)!;
    gateway.handleJoin(latecomer, { code: room.code });

    expect(room.game!.order).toContain('late'); // 턴 순서에 편입
    expect(room.players).toHaveLength(3);
    // 화면 복원용 스냅샷을 신규 참가자에게만 보냈다.
    expect(syncSpy).toHaveBeenCalledWith('game:sync', expect.any(Object));
  });

  it('출제자가 새로고침(연결 끊김)해도 턴이 넘어가지 않고, 재접속하면 자리를 이어받는다', () => {
    const host = mockClient('h'); // 첫 출제자
    const guesser = mockClient('g');
    startTwoPlayerGame(host, guesser);
    const room = roomService.getRoomByPlayer('h')!;
    const beforeDrawer = room.game!.drawerId;
    const beforeRound = room.game!.round;

    gateway.handleDisconnect(host); // 출제자 새로고침 → 연결 끊김

    expect(room.game!.drawerId).toBe(beforeDrawer); // 턴 유지(즉시 넘어가지 않음)
    expect(room.game!.round).toBe(beforeRound);

    // 같은 userId('h')로 새 소켓 재접속 → 리바인드
    const host2 = mockClient('h2');
    (host2.data as { userId: string }).userId = 'h';
    gateway.handleJoin(host2, { code: room.code });

    expect(room.game!.drawerId).toBe('h2'); // 새 소켓으로 출제자 자리 복원
  });

  it('혼자서는 게임을 시작할 수 없다', () => {
    const host = mockClient('solo');
    gateway.handleCreate(host, {});
    const errSpy = jest.spyOn(host, 'emit');
    gateway.handleStart(host);

    expect(roomService.getRoomByPlayer('solo')!.game).toBeUndefined(); // 시작 안 됨
    expect(errSpy).toHaveBeenCalledWith('room:error', expect.any(Object));
  });

  it('제시어가 그대로 담긴 채팅은 브로드캐스트하지 않는다(정답 노출 방지)', () => {
    const host = mockClient('h'); // 출제자
    const guesser = mockClient('g');
    startTwoPlayerGame(host, guesser);
    const room = roomService.getRoomByPlayer('h')!;
    const word = room.game!.choices[0];
    gateway.handleSetWord(host, { word });

    // 출제자가 정답 단어를 채팅에 그대로 적어도 방에 퍼지지 않는다.
    gateway.handleChat(host, { text: word });
    expect(events('chat:message')).toHaveLength(0);

    // 일반 잡담은 정상적으로 브로드캐스트된다.
    gateway.handleChat(guesser, { text: '음 이거 뭐지?' });
    expect(events('chat:message')).toHaveLength(1);
  });

  it('빈 채팅/잘못된 페이로드는 무시한다', () => {
    const host = mockClient('h');
    const guesser = mockClient('g');
    startTwoPlayerGame(host, guesser);

    gateway.handleChat(guesser, { text: '   ' });
    gateway.handleChat(guesser, {} as { text: string }); // text 누락
    expect(events('chat:message')).toHaveLength(0);
  });

  it('되돌리기는 마지막 획(드래그) 하나만 지우고 방 전체에 남은 획을 재동기화한다', () => {
    const host = mockClient('h'); // 첫 출제자
    const guesser = mockClient('g');
    startTwoPlayerGame(host, guesser);
    const room = roomService.getRoomByPlayer('h')!;
    gateway.handleSetWord(host, { word: room.game!.choices[0] }); // drawing 단계 진입

    const seg = (start: boolean) => ({
      x0: 0,
      y0: 0,
      x1: 1,
      y1: 1,
      color: '#000',
      width: 4,
      start,
    });
    // 획1(선분 2개) + 획2(선분 2개)
    gateway.handleDrawStroke(host, seg(true));
    gateway.handleDrawStroke(host, seg(false));
    gateway.handleDrawStroke(host, seg(true));
    gateway.handleDrawStroke(host, seg(false));
    expect(room.game!.strokes).toHaveLength(4);

    gateway.handleDrawUndo(host);

    expect(room.game!.strokes).toHaveLength(2); // 마지막 획만 제거
    const sync = events('draw:strokes');
    expect(sync[sync.length - 1].payload).toHaveLength(2); // 남은 획을 방 전체에 재전송
  });

  it('나가거나 접속이 끊긴 플레이어의 턴은 건너뛴다', () => {
    const host = mockClient('h'); // order[0]
    const g2 = mockClient('g2'); // order[1] — 도중에 끊길 사람
    const g3 = mockClient('g3'); // order[2]
    gateway.handleCreate(host, {});
    const room = roomService.getRoomByPlayer('h')!;
    gateway.handleJoin(g2, { code: room.code });
    gateway.handleJoin(g3, { code: room.code });
    gateway.handleStart(host);

    gateway.handleDisconnect(g2); // 게임 중 → 유예(방엔 남되 connected=false)

    // 호스트가 단어를 정하고, 연결된 유일한 추측자 g3가 맞히면 턴이 조기 종료된다.
    const word = room.game!.choices[0];
    gateway.handleSetWord(host, { word });
    gateway.handleChat(g3, { text: word });
    jest.advanceTimersByTime(TURN_END_SECONDS * 1000); // 공개 연출 뒤 다음 턴

    const turns = events('game:turn');
    const lastDrawer = (turns[turns.length - 1].payload as { drawerId: string })
      .drawerId;
    expect(lastDrawer).toBe('g3'); // g2(끊김)를 건너뛰고 g3가 출제자
  });
});
