import { Injectable } from '@nestjs/common';
import {
  GameService,
  TURN_END_SECONDS,
  WORD_SELECT_SECONDS,
} from './game.service';
import type { Room } from './game.types';
import { RoomBroadcaster } from './room.broadcaster';
import { toPublicPlayers } from './room.mapper';
import { RoomService } from './room.service';
import { TimerRegistry } from './timer-registry';

// 재시작 복원 직후엔 마감이 이미 지났을 수 있다. 재접속할 시간을 주려 최소 이만큼 턴을 연장한다.
const RESTORE_MIN_TURN_MS = 15_000;

/**
 * 턴 생명주기(단어 선택 → 그리기 → 정답 공개 → 다음 턴)와 턴 제한시간 타이머를 관리한다.
 * 서버가 진행의 기준이므로 제한시간은 서버 setTimeout으로 다룬다.
 */
@Injectable()
export class TurnManager {
  private readonly timers = new TimerRegistry();

  constructor(
    private readonly rooms: RoomService,
    private readonly game: GameService,
    private readonly bc: RoomBroadcaster,
  ) {}

  /** 턴 시작을 방에 알리고 출제자에게 단어 후보를 보낸다. 단어 입력 제한시간을 건다. */
  announceTurn(room: Room): void {
    const game = room.game;
    if (!game) return;

    game.phase = 'selecting';
    game.deadline = Date.now() + WORD_SELECT_SECONDS * 1000;
    this.bc.server.to(room.code).emit('game:turn', {
      round: game.round,
      totalRounds: game.totalRounds,
      drawerId: game.drawerId,
      selectDuration: WORD_SELECT_SECONDS,
    });
    // 후보 단어는 출제자에게만 보낸다(추측자에게 노출되면 안 됨).
    this.bc.server.to(game.drawerId).emit('game:word-choices', {
      choices: game.choices,
      duration: WORD_SELECT_SECONDS,
    });

    // 출제자가 제한시간 내에 단어를 정하지 않으면 턴을 건너뛴다.
    this.timers.set(room.code, WORD_SELECT_SECONDS * 1000, () =>
      this.endTurn(room.code),
    );
  }

  /** 출제자가 단어를 고르면 그리기 단계로 전환하고 그리기 제한시간을 건다. */
  beginDrawing(room: Room, word: string): void {
    const game = room.game;
    if (!game) return;
    game.word = word;
    game.phase = 'drawing';
    game.deadline = Date.now() + room.roundSeconds * 1000;
    this.bc.server.to(room.code).emit('game:turn-start', {
      wordLength: word.length,
      duration: room.roundSeconds,
    });
    this.timers.set(room.code, room.roundSeconds * 1000, () =>
      this.endTurn(room.code),
    );
  }

  /**
   * 턴이 끝났을 때(모두 정답·시간초과·출제자 이탈) 정답을 공개하고 잠시 뒤 다음 턴으로 넘긴다.
   * 단어가 정해지지 않은 턴(출제자 미선정)은 공개할 게 없어 곧바로 넘긴다.
   */
  endTurn(code: string): void {
    const room = this.rooms.getRoom(code);
    if (!room?.game) {
      this.timers.clear(code);
      return;
    }
    const game = room.game;
    this.timers.clear(code);

    if (!game.word) {
      this.advanceToNext(code);
      return;
    }

    const correctGuessers = game.correctGuessers
      .map((id) => room.players.find((p) => p.id === id)?.nickname)
      .filter((nickname): nickname is string => !!nickname);

    this.bc.server.to(code).emit('game:turn-end', {
      word: game.word,
      correctGuessers,
      players: room.players.map((p) => ({
        nickname: p.nickname,
        score: p.score,
      })),
      duration: TURN_END_SECONDS,
    });

    this.timers.set(code, TURN_END_SECONDS * 1000, () =>
      this.advanceToNext(code),
    );
  }

  /** 복원된 방의 진행 타이머를 다시 건다(마감이 지났으면 재접속 시간만큼 연장). */
  rearm(room: Room): void {
    if (!room.game) return;
    const remainingMs = Math.max(0, room.game.deadline - Date.now());
    const ms = Math.max(remainingMs, RESTORE_MIN_TURN_MS);
    this.timers.set(room.code, ms, () => this.endTurn(room.code));
  }

  private advanceToNext(code: string): void {
    const room = this.rooms.getRoom(code);
    if (!room?.game) {
      this.timers.clear(code);
      return;
    }
    const game = this.game.advance(room);
    if (game.status === 'ended') {
      this.timers.clear(code);
      room.game = undefined;
      this.bc.lobby(); // 게임중 → 대기중 상태 반영
      const ranking = toPublicPlayers(room).sort((a, b) => b.score - a.score);
      this.bc.server.to(code).emit('game:ended', { ranking });
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
}
