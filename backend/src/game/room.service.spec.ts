import { RoomService } from './room.service';

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(() => {
    service = new RoomService();
  });

  describe('createRoom 옵션 보정', () => {
    it('기본값을 채운다 (옵션 없음)', () => {
      const room = service.createRoom('host', 'u-host', 'Alice');
      expect(room.isPublic).toBe(true);
      expect(room.maxPlayers).toBe(8);
      expect(room.totalRounds).toBe(3);
      expect(room.roundSeconds).toBe(80);
      expect(room.name).toBe('Alice님의 방'); // 빈 이름은 닉네임 기반으로 폴백
    });

    it('범위를 벗어난 값을 클램핑한다', () => {
      const room = service.createRoom('host', 'u-host', 'Alice', {
        maxPlayers: 999,
        totalRounds: 0,
        roundSeconds: 5,
      });
      expect(room.maxPlayers).toBe(8); // [2, 8]
      expect(room.totalRounds).toBe(1); // [1, 10]
      expect(room.roundSeconds).toBe(30); // [30, 180]
    });

    it('잘못된(숫자 아님) 값은 최소값으로 떨어진다', () => {
      const room = service.createRoom('host', 'u-host', 'Alice', {
        maxPlayers: NaN,
        totalRounds: undefined,
      });
      expect(room.maxPlayers).toBe(2);
      expect(room.totalRounds).toBe(3); // undefined는 기본값(3)이 먼저 적용
    });

    it('이름은 앞뒤 공백 제거 후 20자로 자른다', () => {
      const room = service.createRoom('host', 'u-host', 'Alice', {
        name: '  ' + 'x'.repeat(30) + '  ',
      });
      expect(room.name).toBe('x'.repeat(20));
    });
  });

  describe('joinRoom 정원 가드', () => {
    it('정원이 차면 새 입장을 막는다', () => {
      const room = service.createRoom('host', 'u-host', '방장', {
        maxPlayers: 2,
      });
      service.joinRoom(room.code, 'p2', 'u-p2', '둘');
      expect(() => service.joinRoom(room.code, 'p3', 'u-p3', '셋')).toThrow(
        '방이 가득 찼어요.',
      );
    });

    it('이미 들어온 사람은 정원과 무관하게 통과한다(중복 추가 없음)', () => {
      const room = service.createRoom('host', 'u-host', '방장', {
        maxPlayers: 1,
      });
      const again = service.joinRoom(room.code, 'host', 'u-host', '방장');
      expect(again.players).toHaveLength(1);
    });

    it('없는 방이면 예외', () => {
      expect(() => service.joinRoom('ZZZZ', 'p', 'u-p', '이름')).toThrow(
        '존재하지 않는 방이에요.',
      );
    });
  });

  describe('updateRoom 부분 갱신', () => {
    it('넘어온 필드만 바꾸고 나머지는 유지한다', () => {
      const room = service.createRoom('h1', 'u1', 'Alice', {
        isPublic: true,
        totalRounds: 3,
        roundSeconds: 80,
      });
      service.updateRoom(room.code, { totalRounds: 7, isPublic: false });
      expect(room.totalRounds).toBe(7);
      expect(room.isPublic).toBe(false);
      expect(room.roundSeconds).toBe(80); // 안 넘긴 필드는 그대로
    });

    it('최대 인원을 현재 인원보다 적게 줄일 수 없다', () => {
      const room = service.createRoom('h1', 'u1', 'Alice', { maxPlayers: 8 });
      service.joinRoom(room.code, 'p2', 'u2', 'Bob');
      service.joinRoom(room.code, 'p3', 'u3', 'Carol');
      service.updateRoom(room.code, { maxPlayers: 2 }); // 현재 3명
      expect(room.maxPlayers).toBe(3); // 현재 인원까지만 축소
    });

    it('빈 이름은 무시하고 기존 이름을 유지한다', () => {
      const room = service.createRoom('h1', 'u1', 'Alice', { name: '내 방' });
      service.updateRoom(room.code, { name: '   ' });
      expect(room.name).toBe('내 방');
    });

    it('없는 방이면 예외', () => {
      expect(() => service.updateRoom('ZZZZ', { totalRounds: 5 })).toThrow(
        '존재하지 않는 방이에요.',
      );
    });
  });

  describe('listPublicRooms', () => {
    it('비공개방은 제외하고 공개방만 요약한다', () => {
      const pub = service.createRoom('h1', 'u1', 'Alice', { isPublic: true });
      service.createRoom('h2', 'u2', 'Bob', { isPublic: false });

      const list = service.listPublicRooms();
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        code: pub.code,
        name: 'Alice님의 방',
        host: 'Alice',
        count: 1,
        status: 'waiting',
      });
    });

    it('인원 수와 정원을 정확히 담는다', () => {
      const room = service.createRoom('h1', 'u1', 'Alice', { maxPlayers: 4 });
      service.joinRoom(room.code, 'p2', 'u2', 'Bob');

      const [summary] = service.listPublicRooms();
      expect(summary.count).toBe(2);
      expect(summary.max).toBe(4);
    });
  });

  describe('재접속 (markDisconnected + rebindPlayer)', () => {
    it('접속이 끊기면 connected=false로만 표시하고 자리를 유지한다', () => {
      const room = service.createRoom('h1', 'u1', 'Alice');
      service.joinRoom(room.code, 'sock-2', 'u2', 'Bob');

      service.markDisconnected('sock-2');
      const bob = room.players.find((p) => p.userId === 'u2');
      expect(bob?.connected).toBe(false);
      expect(room.players).toHaveLength(2); // 아직 제거하지 않는다
    });

    it('userId로 새 소켓에 다시 연결하며 점수·방장 권한을 유지한다', () => {
      const room = service.createRoom('sock-h', 'u-host', 'Alice');
      const host = room.players[0];
      host.score = 42; // 게임 중 점수가 쌓였다고 가정

      service.markDisconnected('sock-h');
      const rebound = service.rebindPlayer(room, 'u-host', 'sock-h-new');

      expect(rebound?.id).toBe('sock-h-new'); // 새 소켓으로 갈아끼움
      expect(rebound?.connected).toBe(true);
      expect(rebound?.score).toBe(42); // 점수 유지
      expect(room.hostId).toBe('sock-h-new'); // 방장 권한도 새 소켓으로 이전
    });

    it('없는 userId면 null을 돌려 신규 입장으로 처리하게 한다', () => {
      const room = service.createRoom('sock-h', 'u-host', 'Alice');
      expect(service.rebindPlayer(room, 'unknown', 'sock-x')).toBeNull();
    });
  });
});
