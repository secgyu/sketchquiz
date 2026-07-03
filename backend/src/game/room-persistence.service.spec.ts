import type { PrismaService } from '../prisma/prisma.service';
import { RoomPersistenceService } from './room-persistence.service';
import { RoomService } from './room.service';

/** gameRoom 델리게이트와 $transaction만 흉내내는 최소 Prisma 목. */
function mockPrisma() {
  const gameRoom = {
    findMany: jest.fn(),
    upsert: jest.fn((args: unknown) => args), // 트랜잭션 배열에 그대로 담기게 인자를 반환
    deleteMany: jest.fn((args: unknown) => args),
  };
  return {
    gameRoom,
    $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops)),
  };
}

describe('RoomPersistenceService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let rooms: RoomService;
  let svc: RoomPersistenceService;

  beforeEach(() => {
    prisma = mockPrisma();
    rooms = new RoomService();
    svc = new RoomPersistenceService(prisma as unknown as PrismaService, rooms);
  });

  it('snapshot은 살아있는 방을 upsert하고 사라진 방은 삭제 대상으로 넘긴다', async () => {
    const room = rooms.createRoom('h', 'u-h', 'Alice');

    await svc.snapshot();

    expect(prisma.gameRoom.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = prisma.gameRoom.upsert.mock.calls[0][0] as {
      where: { code: string };
    };
    expect(upsertArg.where.code).toBe(room.code);
    // 현재 방 목록에 없는 코드는 notIn 필터로 지운다.
    const deleteArg = prisma.gameRoom.deleteMany.mock.calls[0][0] as {
      where: { code: { notIn: string[] } };
    };
    expect(deleteArg.where.code.notIn).toEqual([room.code]);
  });

  it('loadAll은 저장된 JSON 행을 Room 배열로 되돌린다', async () => {
    const saved = { code: 'AB12', players: [] };
    prisma.gameRoom.findMany.mockResolvedValue([{ data: saved }]);

    const loaded = await svc.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].code).toBe('AB12');
  });
});
