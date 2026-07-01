import { Injectable } from '@nestjs/common';
import type { GameState, Room } from './game.types';

export const ROUND_SECONDS = 80; // 그리기/맞히기 제한시간
export const WORD_SELECT_SECONDS = 20; // 출제자 단어 입력 제한시간
export const DEFAULT_TOTAL_ROUNDS = 3;

/**
 * 게임 진행 상태를 계산하는 순수 로직. 소켓/타이머는 게이트웨이가 담당한다.
 * 턴 모델: 한 라운드 동안 order의 모든 플레이어가 한 번씩 출제자가 된다.
 * 제시어는 출제자가 직접 입력하므로, 여기서는 word를 빈 문자열(대기)로 둔다.
 */
@Injectable()
export class GameService {
  start(room: Room, totalRounds: number = DEFAULT_TOTAL_ROUNDS): GameState {
    const order = room.players.map((p) => p.id);
    const game: GameState = {
      status: 'playing',
      round: 1,
      totalRounds,
      order,
      turnIndex: 0,
      drawerId: order[0],
      word: '',
    };
    room.game = game;
    return game;
  }

  /** 다음 턴으로 진행. 라운드를 모두 소진하면 status를 'ended'로 만든다. */
  advance(room: Room): GameState {
    const game = room.game;
    if (!game) throw new Error('진행 중인 게임이 없어요.');

    game.turnIndex += 1;
    if (game.turnIndex >= game.order.length) {
      game.turnIndex = 0;
      game.round += 1;
    }
    if (game.round > game.totalRounds) {
      game.status = 'ended';
      return game;
    }
    game.drawerId = game.order[game.turnIndex];
    game.word = '';
    return game;
  }
}
