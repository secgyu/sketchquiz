import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AuthUser } from "@/lib/api";

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

/** 토큰과 사용자 정보를 localStorage에 영속 저장한다. */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "sketchquiz-auth" },
  ),
);
