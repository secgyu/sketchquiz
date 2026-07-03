// 세션 단위 이모지 아바타. DB에 저장하지 않고 소켓 핸드셰이크로 방에 전달한다.
// ponytail: 기기/재로그인 간 이어지지 않는다(브라우저 로컬 저장). 필요해지면 User 테이블에 컬럼 추가로 승격.
const KEY = "sq_avatar";

/** 고를 수 있는 이모지 팔레트 */
export const AVATARS = [
  "🐱", "🐶", "🦊", "🐰", "🐻", "🐼", "🐸", "🐵",
  "🦁", "🐯", "🐨", "🐷", "🦄", "🐙", "🐧", "🐢",
  "🦉", "🐝", "🦋", "🌟", "🍀", "🔥", "🎈", "👾",
];

export function getAvatar(): string {
  return localStorage.getItem(KEY) ?? "";
}

export function setAvatar(emoji: string): void {
  if (emoji) localStorage.setItem(KEY, emoji);
  else localStorage.removeItem(KEY);
}
