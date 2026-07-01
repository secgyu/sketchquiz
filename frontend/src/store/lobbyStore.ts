import { create } from "zustand";

export type RoomStatus = "waiting" | "playing";

export interface PublicRoom {
  code: string;
  name: string;
  host: string; // 방장 닉네임
  count: number; // 현재 인원
  max: number; // 정원
  status: RoomStatus;
  round: number; // 총 라운드 수
  createdAt: number; // 생성 시각(epoch ms) — 최신순 정렬용
}

interface LobbyStore {
  rooms: PublicRoom[];
  setRooms: (rooms: PublicRoom[]) => void;
}

// ponytail: 백엔드 room:list 연동 전 UI 확인용 임시 데이터. 연동 시 setRooms로 대체된다.
const now = Date.now();
const SAMPLE_ROOMS: PublicRoom[] = [
  {
    code: "K7Q2",
    name: "초보만 들어와요 그림똥손 환영",
    host: "감자도리",
    count: 3,
    max: 8,
    status: "waiting",
    round: 3,
    createdAt: now - 30_000,
  },
  {
    code: "M4XP",
    name: "그림 고수들의 대결",
    host: "피카소",
    count: 6,
    max: 6,
    status: "playing",
    round: 5,
    createdAt: now - 600_000,
  },
  {
    code: "B9ZT",
    name: "심심한 사람 모여라~",
    host: "냥냥펀치",
    count: 2,
    max: 8,
    status: "waiting",
    round: 3,
    createdAt: now - 8_000,
  },
  {
    code: "R3WK",
    name: "빠른 한판 4라운드",
    host: "번개맨",
    count: 4,
    max: 6,
    status: "playing",
    round: 4,
    createdAt: now - 300_000,
  },
  {
    code: "T8LM",
    name: "친목방 (수다 환영)",
    host: "수다쟁이",
    count: 5,
    max: 8,
    status: "waiting",
    round: 3,
    createdAt: now - 120_000,
  },
  {
    code: "V2NC",
    name: "실력자만 정원 꽉참",
    host: "다빈치",
    count: 6,
    max: 6,
    status: "waiting",
    round: 5,
    createdAt: now - 45_000,
  },
];

/**
 * 공개방 목록 상태. 진실의 원천은 서버(room:list)가 될 예정이며,
 * 현재는 UI 확인을 위한 임시 샘플로 초기화한다.
 */
export const useLobbyStore = create<LobbyStore>((set) => ({
  rooms: SAMPLE_ROOMS,
  setRooms: (rooms) => set({ rooms }),
}));
