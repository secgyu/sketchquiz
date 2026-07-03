import { Outlet, useLocation } from "react-router";

import { ConnectionBanner } from "@/components/ConnectionBanner";
import { useRoomSocket } from "@/hooks/useRoomSocket";

/**
 * /room/:code 하위(대기실·게임·결과)를 감싸는 레이아웃.
 * 방·게임 소켓 리스너는 useRoomSocket에 모으고, 여기선 공통 UI와 화면 전환 연출만 담당한다.
 */
export function RoomLayout() {
  useRoomSocket();

  // 대기실 → 게임 → 결과 사이 전환에만 애니메이션(RoomLayout 자체는 유지).
  const pathname = useLocation().pathname;
  return (
    <>
      <ConnectionBanner />
      <div key={pathname} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <Outlet />
      </div>
    </>
  );
}
