export interface Player {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  isDrawing: boolean;
  hasGuessed: boolean;
  connected?: boolean; // 재접속 대기 중이면 false → 목록에서 흐리게 표시
}

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

const AVATAR_COLORS = [
  "bg-brand-yellow",
  "bg-brand-pink",
  "bg-brand-blue",
  "bg-brand-green",
  "bg-brand-purple",
  "bg-brand-orange",
];

/** 닉네임을 안정적으로 색상에 매핑한다 (같은 이름 → 항상 같은 색) */
export function avatarColor(nickname: string): string {
  let hash = 0;
  for (const ch of nickname) hash = (hash + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}
