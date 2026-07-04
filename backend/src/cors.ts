/**
 * 허용할 프론트엔드 오리진 목록.
 * CORS_ORIGIN 환경변수에 콤마로 여러 개 지정할 수 있고(개발+운영 동시 허용), 없으면 로컬 개발 기본값.
 * HTTP(main.ts)와 WebSocket(game.gateway.ts)이 같은 규칙을 공유하도록 한 곳에서 계산한다.
 */
export function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
