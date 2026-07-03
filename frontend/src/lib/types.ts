import type { Player } from "@/lib/socket";

export type ChatKind = "chat" | "correct" | "system";

export interface ChatMessage {
  id: string;
  kind: ChatKind;
  nickname?: string;
  text: string;
}

/** 대기실 표시용 기본 설정값 (서버 game.service 상수와 일치) */
export const DEFAULT_TOTAL_ROUNDS = 3;
export const DEFAULT_ROUND_SECONDS = 80;

/** 서버 플레이어(wire)에 화면 표시용 상태 플래그를 덧입힌 타입. */
export interface PlayerView extends Player {
  isHost: boolean;
  isDrawing: boolean;
  hasGuessed: boolean;
}

/** 서버 플레이어 목록에 방장·출제자·정답 여부를 덧입혀 화면용으로 변환한다. */
export function decoratePlayers(
  players: Player[],
  ctx: { hostId?: string; drawerId?: string; correctIds?: string[] },
): PlayerView[] {
  return players.map((p) => ({
    ...p,
    isHost: p.id === ctx.hostId,
    isDrawing: p.id === ctx.drawerId,
    hasGuessed: ctx.correctIds?.includes(p.id) ?? false,
  }));
}
