import { Outlet } from "react-router";

import { Toaster } from "@/components/ui/toast";

/** 모든 라우트를 감싸 전역 토스트를 한 번만 마운트한다. */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
