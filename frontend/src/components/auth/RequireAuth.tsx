import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { useAuthStore } from "@/store/authStore";

/** 로그인하지 않은 사용자는 /login으로 보낸다. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
