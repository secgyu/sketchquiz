import { io, type Socket } from "socket.io-client";

import { API_URL } from "@/lib/api";
import { getAvatar } from "@/lib/avatar";
import { useAuthStore } from "@/store/authStore";

// 실시간 통신 계약은 백엔드가 단일 소스다. 여기선 타입만 재노출해 기존 import 경로를 유지한다.
// (@shared/protocol → backend/src/game/protocol.ts, import type라 런타임 번들엔 포함되지 않음)
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/protocol";

export type { DrawStroke, Player, RoomState, RoomStatus } from "@shared/protocol";
// 프론트에서 쓰던 이름과 백엔드 계약 이름을 이어 붙인다(별칭).
export type { CreateRoomPayload as CreateRoomOptions, PublicRoomSummary as PublicRoom } from "@shared/protocol";
export type { ServerToClientEvents, ClientToServerEvents } from "@shared/protocol";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ponytail: 세션 전체가 하나의 소켓을 공유한다(방/화면마다 재연결 불필요).
let socket: AppSocket | null = null;

/**
 * 소켓 싱글톤을 반환한다. 최초 호출 시 생성만 하고 자동 연결하지 않는다(autoConnect: false).
 * auth.token은 함수로 넘겨 매 연결 시 최신 JWT를 읽는다(로그인 갱신 대응).
 */
export function getSocket(): AppSocket {
  if (socket) return socket;
  socket = io(API_URL, {
    autoConnect: false,
    auth: (cb) => cb({ token: useAuthStore.getState().token ?? "", avatar: getAvatar() }),
  });
  return socket;
}

/** 로그아웃 등에서 연결을 완전히 끊는다. */
export function disconnectSocket(): void {
  socket?.disconnect();
}
