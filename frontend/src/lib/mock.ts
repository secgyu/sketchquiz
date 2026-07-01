export interface Player {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  isDrawing: boolean;
  hasGuessed: boolean;
}

export type ChatKind = "chat" | "correct" | "system";

export interface ChatMessage {
  id: string;
  kind: ChatKind;
  nickname?: string;
  text: string;
}

export type Screen = "start" | "lobby" | "game" | "result";

/** 방 코드 4자리 생성 (헷갈리는 0/O/1/I 제외) */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export const MOCK_PLAYERS: Player[] = [
  { id: "p1", nickname: "철수", score: 1240, isHost: true, isDrawing: true, hasGuessed: false },
  { id: "p2", nickname: "영희", score: 980, isHost: false, isDrawing: false, hasGuessed: true },
  { id: "p3", nickname: "민준", score: 760, isHost: false, isDrawing: false, hasGuessed: true },
  { id: "p4", nickname: "수아", score: 520, isHost: false, isDrawing: false, hasGuessed: false },
  { id: "p5", nickname: "지호", score: 300, isHost: false, isDrawing: false, hasGuessed: false },
];

export const MOCK_MESSAGES: ChatMessage[] = [
  { id: "m1", kind: "system", text: "철수님이 그림을 그리고 있어요!" },
  { id: "m2", kind: "chat", nickname: "수아", text: "동물인가?" },
  { id: "m3", kind: "chat", nickname: "지호", text: "강아지!" },
  { id: "m4", kind: "correct", nickname: "영희", text: "영희님이 정답을 맞혔어요!" },
  { id: "m5", kind: "chat", nickname: "수아", text: "헐 뭐지" },
  { id: "m6", kind: "correct", nickname: "민준", text: "민준님이 정답을 맞혔어요!" },
];

/** 출제자에게만 보이는 제시어 (목업) */
export const MOCK_WORD = "고양이";

/** 추측자에게 보이는 글자 수 (서버는 단어 대신 길이만 내려준다) */
export const MOCK_WORD_LENGTH = MOCK_WORD.length;

export const MOCK_ROUND = 2;
export const MOCK_TOTAL_ROUNDS = 3;
export const MOCK_ROUND_SECONDS = 80;

export const MOCK_WORD_CHOICES = ["고양이", "비행기", "햄버거"];

/** 결과 화면용 최종 순위 (점수 내림차순) */
export const MOCK_RANKING: Player[] = [...MOCK_PLAYERS].sort((a, b) => b.score - a.score);

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
