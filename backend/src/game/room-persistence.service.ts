import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Room } from './game.types';
import { RoomService } from './room.service';

// 스냅샷 주기. 서버가 죽으면 최대 이만큼의 진행 상태가 손실될 수 있다(재시작 복구용 내구성 미러).
// ponytail: 그리기/채팅 같은 핫패스를 건드리지 않으려고 매 이벤트 저장 대신 주기 스냅샷을 택했다.
//           손실 폭을 줄이려면 턴 경계에서 강제 스냅샷을 추가하면 된다.
const SNAPSHOT_INTERVAL_MS = 5000;

/**
 * 인메모리 방 상태를 Postgres에 주기적으로 미러링한다(서버 재시작 시 복원용).
 * 런타임 진실의 원천은 여전히 RoomService의 인메모리 Map이다. 이 서비스는 내구성만 담당한다.
 */
@Injectable()
export class RoomPersistenceService implements OnModuleDestroy {
  private readonly logger = new Logger(RoomPersistenceService.name);
  private timer?: NodeJS.Timeout;
  private saving = false; // 스냅샷이 밀릴 때 중첩 실행 방지

  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomService,
  ) {}

  /** 부팅 시 저장된 방들을 읽어온다(복원·타이머 재무장은 게이트웨이가 담당). */
  async loadAll(): Promise<Room[]> {
    const rows = await this.prisma.gameRoom.findMany();
    return rows.map((row) => row.data as unknown as Room);
  }

  /** 주기 스냅샷 시작(게이트웨이가 복원을 끝낸 뒤 호출). */
  startSnapshots(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.snapshot(), SNAPSHOT_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** 현재 인메모리 방 전체를 DB에 반영하고, 사라진 방 행은 지운다. */
  async snapshot(): Promise<void> {
    if (this.saving) return; // 이전 스냅샷이 아직 진행 중이면 이번 틱은 건너뛴다
    this.saving = true;
    try {
      const rooms = this.rooms.getAllRooms();
      const codes = rooms.map((room) => room.code);
      const upserts = rooms.map((room) => {
        // JSON 왕복 복제로 순수 데이터만 남기고, 저장 도중 원본 변경과도 분리한다.
        const data = JSON.parse(JSON.stringify(room)) as object;
        return this.prisma.gameRoom.upsert({
          where: { code: room.code },
          create: { code: room.code, data },
          update: { data },
        });
      });
      // 목록에 없는(=삭제된) 방 행 제거. 방이 하나도 없으면 전체 삭제(빈 notIn의 모호함 회피).
      const purge = codes.length
        ? this.prisma.gameRoom.deleteMany({ where: { code: { notIn: codes } } })
        : this.prisma.gameRoom.deleteMany({});
      await this.prisma.$transaction([...upserts, purge]);
    } catch (err) {
      this.logger.error('방 상태 스냅샷 저장 실패', err as Error);
    } finally {
      this.saving = false;
    }
  }
}
