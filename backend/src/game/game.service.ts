import { Injectable } from '@nestjs/common';
import type { GameState, GuessResult, Room } from './game.types';
import { pickChoices } from './words';

export const ROUND_SECONDS = 80; // 그리기/맞히기 제한시간
export const WORD_SELECT_SECONDS = 20; // 출제자 단어 입력 제한시간
export const TURN_END_SECONDS = 5; // 턴 종료 후 정답 공개 연출 시간
export const WORD_CHOICE_COUNT = 3; // 출제자에게 제시하는 3지선다 후보 수
export const DEFAULT_TOTAL_ROUNDS = 3;
const DRAWER_POINTS = 30; // 정답자 1명당 출제자에게 주는 점수

/**
 * 게임 진행 상태를 계산하는 순수 로직. 소켓/타이머는 게이트웨이가 담당한다.
 * 턴 모델: 한 라운드 동안 order의 모든 플레이어가 한 번씩 출제자가 된다.
 * 제시어는 출제자가 직접 입력하므로, 여기서는 word를 빈 문자열(대기)로 둔다.
 */
@Injectable()
export class GameService {
  start(room: Room): GameState {
    room.players.forEach((p) => (p.score = 0)); // 새 게임 시작 시 점수 초기화
    const order = room.players.map((p) => p.id);
    const game: GameState = {
      status: 'playing',
      round: 1,
      totalRounds: room.totalRounds,
      order,
      turnIndex: 0,
      drawerId: order[0],
      word: '',
      choices: pickChoices(WORD_CHOICE_COUNT),
      correctGuessers: [],
      phase: 'selecting',
      deadline: 0, // 게이트웨이가 announceTurn에서 실제 마감 시각으로 채운다
      strokes: [],
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
    game.choices = pickChoices(WORD_CHOICE_COUNT);
    game.correctGuessers = [];
    game.phase = 'selecting';
    game.deadline = 0;
    game.strokes = [];
    return game;
  }

  /**
   * 채팅 메시지가 정답인지 판정하고, 정답이면 점수를 반영한다.
   * 정답이 아니거나 게임 중이 아니면 'chat'(일반 채팅)로 처리하라는 뜻이다.
   */
  checkGuess(room: Room, guesserId: string, text: string): GuessResult {
    const game = room.game;
    const guess = text.trim();
    if (!game || !game.word || !guess) return { status: 'chat' };
    if (guesserId === game.drawerId) return { status: 'chat' };
    if (guess.toLowerCase() !== game.word.toLowerCase())
      return { status: 'chat' };
    if (game.correctGuessers.includes(guesserId)) return { status: 'already' };

    const order = game.correctGuessers.length; // 이번 턴 정답 순서 (0-based)
    this.award(room, guesserId, Math.max(40, 100 - order * 20));
    this.award(room, game.drawerId, DRAWER_POINTS);
    game.correctGuessers.push(guesserId);

    // 접속이 끊긴 사람은 맞힐 수 없으니 조기 종료 판정에서 제외한다(연결된 추측자만 카운트).
    const nonDrawerCount = room.players.filter(
      (p) => p.connected && p.id !== game.drawerId,
    ).length;
    return {
      status: 'correct',
      allGuessed: game.correctGuessers.length >= nonDrawerCount,
    };
  }

  private award(room: Room, playerId: string, points: number) {
    const player = room.players.find((p) => p.id === playerId);
    if (player) player.score += points;
  }
}
