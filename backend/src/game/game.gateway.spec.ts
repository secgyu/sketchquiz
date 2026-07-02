import type { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { GameGateway } from './game.gateway';
import { GameService, TURN_END_SECONDS } from './game.service';
import { RoomService } from './room.service';

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
    gateway = new GameGateway(roomService, new GameService(), {} as JwtService);
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
});
