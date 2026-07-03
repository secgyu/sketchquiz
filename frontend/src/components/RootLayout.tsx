import { Outlet, useLocation } from "react-router";

import { Toaster } from "@/components/ui/toast";

/** 모든 라우트를 감싸 전역 토스트를 한 번만 마운트한다. */
export function RootLayout() {
  // 최상위 세그먼트가 바뀔 때만 전환 애니메이션을 재생한다.
  // (/room 하위 이동은 키가 그대로 → RoomLayout이 언마운트되지 않아 소켓 리스너 유지)
  const segment = useLocation().pathname.split("/")[1] || "home";
  return (
    <>
      <div key={segment} className="animate-in fade-in duration-300">
        <Outlet />
      </div>
      <Toaster />
    </>
  );
}
