import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Clock, DoorOpen } from "lucide-react";

import { CanvasBoard } from "@/components/game/CanvasBoard";
import { ChatPanel } from "@/components/game/ChatPanel";
import { PlayerList } from "@/components/game/PlayerList";
import { Button } from "@/components/ui/button";
import { MOCK_ROUND, MOCK_ROUND_SECONDS, MOCK_TOTAL_ROUNDS, MOCK_WORD } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";

/** 출제자가 그리는 단어를 글자 타일로 보여준다 (추측자에겐 빈 칸으로 내려간다) */
function WordTiles({ word, revealed }: { word: string; revealed: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {[...word].map((ch, i) => (
        <span
          key={i}
          className="flex size-10 items-center justify-center rounded-lg border-[3px] border-ink bg-brand-yellow text-xl font-black text-ink shadow-[2px_2px_0_0_var(--color-ink)]"
        >
          {revealed ? ch : ""}
        </span>
      ))}
      <span className="ml-1.5 text-sm font-black text-ink">{word.length}글자</span>
    </div>
  );
}

export function GameScreen() {
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const players = useGameStore((s) => s.players);
  const [timeLeft, setTimeLeft] = useState(MOCK_ROUND_SECONDS);

  // 표시용 카운트다운 (실제 라운드 종료 판정은 추후 서버가 담당)
  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft]);

  const urgent = timeLeft <= 10;
  const progress = (timeLeft / MOCK_ROUND_SECONDS) * 100;

  return (
    <div className="brutal-bg h-svh overflow-hidden p-4">
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-[3px] border-ink bg-white px-4 py-3 shadow-hard">
          <div className="rounded-lg border-2 border-ink bg-brand-purple px-3 py-1.5 text-sm font-black text-ink">
            라운드 {MOCK_ROUND} / {MOCK_TOTAL_ROUNDS}
          </div>

          <WordTiles word={MOCK_WORD} revealed />

          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 border-ink px-3 py-1.5",
                urgent ? "bg-brand-red" : "bg-brand-green",
              )}
            >
              <Clock className="size-5 text-ink" strokeWidth={2.5} />
              <span className="w-7 text-xl font-black text-ink tabular-nums">{timeLeft}</span>
            </div>
            <Button size="sm" variant="default" onClick={() => navigate(`/room/${code}/result`)}>
              결과 보기
            </Button>
          </div>
        </header>

        <div className="h-3 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-white">
          <div
            className={cn(
              "h-full transition-[width] duration-1000 ease-linear",
              urgent ? "bg-brand-red" : "bg-brand-pink",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto md:grid-cols-[230px_1fr_320px] md:overflow-hidden">
          <aside className="flex min-h-0 flex-col rounded-xl border-[3px] border-ink bg-white p-3 shadow-hard">
            <h2 className="mb-2 inline-block self-start -rotate-1 border-2 border-ink bg-brand-blue px-2 py-0.5 text-xs font-black uppercase text-ink">
              플레이어 {players.length}
            </h2>
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
              <PlayerList players={players} ranked />
            </div>
          </aside>

          <section className="min-h-[340px] md:min-h-0">
            <CanvasBoard canDraw />
          </section>

          <aside className="flex min-h-[340px] flex-col rounded-xl border-[3px] border-ink bg-white p-3 shadow-hard md:min-h-0">
            <ChatPanel />
          </aside>
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="mx-auto flex shrink-0 items-center gap-1.5 border-2 border-ink bg-white px-3 py-1 text-sm font-black text-ink shadow-[2px_2px_0_0_var(--color-ink)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          <DoorOpen className="size-4" strokeWidth={2.5} />방 나가기
        </button>
      </div>
    </div>
  );
}
