import { Injectable } from '@nestjs/common';
import { RoomBroadcaster } from './room.broadcaster';
import { RoomService } from './room.service';
import { TurnManager } from './turn.manager';

const RECONNECT_GRACE_MS = 60_000; // 게임 중 연결이 끊겨도 이 시간 안에 돌아오면 자리를 지켜준다

/**
 * 게임 중 연결이 끊긴 플레이어의 재접속 유예를 관리한다.
 * 유예 안에 돌아오면 취소되고, 만료되면 실제로 방에서 제거한다.
 */
@Injectable()
export class ReconnectManager {
  // 재접속 유예 타이머 (userId → 제거 예약). 돌아오면 취소한다.
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly rooms: RoomService,
    private readonly bc: RoomBroadcaster,
    private readonly turns: TurnManager,
  ) {}

  /** 재접속 유예가 끝나면 실제로 방에서 제거한다(돌아왔거나 사라졌으면 무시). */
  schedule(
    code: string,
    socketId: string,
    userId: string,
    nickname: string,
  ): void {
    this.cancel(userId);
    this.timers.set(
      userId,
      setTimeout(() => {
        this.timers.delete(userId);
        const room = this.rooms.getRoom(code);
        const player = room?.players.find((p) => p.id === socketId);
        if (!player || player.connected) return; // 이미 재접속했다
        const wasDrawer = room?.game?.drawerId === socketId;
        const left = this.rooms.leaveRoom(socketId);
        this.bc.lobby();
        if (!left) return;
        if (nickname) {
          this.bc.server.to(left.code).emit('player:left', { nickname });
        }
        this.bc.state(left);
        if (wasDrawer && left.game) this.turns.endTurn(left.code);
      }, RECONNECT_GRACE_MS),
    );
  }

  cancel(userId: string): void {
    const timer = this.timers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(userId);
    }
  }
}
