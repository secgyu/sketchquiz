import { useNavigate } from "react-router";
import { Home, MapPinOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export function NotFoundScreen() {
  const navigate = useNavigate();

  return (
    <div className="brutal-bg flex min-h-svh items-center justify-center p-4">
      <main className="w-full max-w-md rounded-2xl border-[3px] border-ink bg-white p-8 text-center shadow-hard-lg">
        <span className="mx-auto mb-5 flex size-16 -rotate-6 items-center justify-center rounded-xl border-[3px] border-ink bg-brand-pink text-white shadow-hard">
          <MapPinOff className="size-8" strokeWidth={2.5} />
        </span>
        <h1 className="text-6xl font-black tracking-tighter text-ink">404</h1>
        <p className="mt-2 inline-block -rotate-1 border-2 border-ink bg-brand-yellow px-3 py-1 text-sm font-bold text-ink">
          여긴 아무 그림도 없네요
        </p>
        <p className="mt-4 text-sm font-bold text-muted-foreground">
          찾으시는 페이지가 없거나 방이 이미 사라졌어요.
        </p>
        <Button size="lg" variant="green" onClick={() => navigate("/")} className="mt-6 w-full text-base">
          <Home strokeWidth={2.5} />
          홈으로 돌아가기
        </Button>
      </main>
    </div>
  );
}
