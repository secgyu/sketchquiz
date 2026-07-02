/** 클라이언트로 내려보내는 플레이어 스냅샷 (userId 같은 서버 비밀은 담지 않는다) */
export interface Player {
  id: string; // 현재 socket id (재접속 시 갱신됨)
  nickname: string;
  score: number;
  connected: boolean; // 재접속 대기 중이면 false (UI에서 흐리게 표시)
}

/** 서버 내부 플레이어. 재접속 매칭용 안정 신원(userId)을 함께 들고 있다. */
export interface ServerPlayer extends Player {
  userId: string; // JWT sub — socket이 바뀌어도 유지되는 신원
}

export type GameStatus = 'playing' | 'ended';

/** 턴 진행 단계. 재접속 스냅샷에서 화면을 복원하는 데 쓴다. */
export type TurnPhase = 'selecting' | 'drawing';

export interface GameState {
  status: GameStatus;
  round: number; // 현재 라운드 (1-based)
  totalRounds: number;
  order: string[]; // 게임 시작 시점 플레이어 id 순서 (턴 순서)
  turnIndex: number; // 현재 라운드 내 턴 위치 (order 인덱스)
  drawerId: string; // 현재 출제자 socket id
  word: string; // 현재 제시어 (서버 비밀). 출제자가 choices 중 하나를 고르기 전엔 빈 문자열
  choices: string[]; // 이번 턴 출제자에게 제시하는 3지선다 후보 (출제자에게만 전송)
  correctGuessers: string[]; // 이번 턴에 정답을 맞힌 플레이어 id (순서 = 점수 차등)
  phase: TurnPhase; // 재접속 복원용 현재 단계
  deadline: number; // 현재 단계 종료 시각(epoch ms) — 재접속 시 남은시간 계산
}

export type GuessResult =
  | { status: 'chat' } // 일반 채팅으로 처리
  | { status: 'already' } // 이미 맞힌 사람의 정답 재입력 (무시)
  | { status: 'correct'; allGuessed: boolean };

export type RoomStatus = 'waiting' | 'playing';

export interface Room {
  code: string;
  hostId: string; // 방장 socket id
  name: string;
  isPublic: boolean;
  maxPlayers: number;
  totalRounds: number;
  roundSeconds: number;
  createdAt: number; // 생성 시각(epoch ms) — 목록 최신순 정렬용
  players: ServerPlayer[];
  game?: GameState;
}

/** 공개방 목록에 노출되는 방 요약 (비밀은 담지 않는다) */
export interface PublicRoomSummary {
  code: string;
  name: string;
  host: string; // 방장 닉네임
  count: number; // 현재 인원
  max: number; // 정원
  status: RoomStatus;
  round: number; // 총 라운드 수
  createdAt: number;
}

/** 클라이언트로 내려보내는 방 상태 스냅샷 */
export interface RoomState {
  code: string;
  hostId: string;
  name: string;
  isPublic: boolean;
  maxPlayers: number;
  totalRounds: number;
  roundSeconds: number;
  status: RoomStatus;
  players: Player[];
}

/** 방 생성 옵션 (모두 선택. 서버가 기본값/범위로 보정한다) */
export interface CreateRoomPayload {
  name?: string;
  isPublic?: boolean;
  maxPlayers?: number;
  totalRounds?: number;
  roundSeconds?: number;
}

/** 소켓 연결에 저장하는 인증된 사용자 정보 (JWT에서 추출) */
export interface SocketData {
  userId: string;
  username: string;
}

export interface JoinRoomPayload {
  code: string;
}

export interface SetWordPayload {
  word: string;
}

export interface ChatMessagePayload {
  text: string;
}

/** 한 획의 선분. 서버는 내용을 해석하지 않고 방에 그대로 중계한다. */
export interface DrawStroke {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
}
