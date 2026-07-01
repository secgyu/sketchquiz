import { useNavigate, useParams } from "react-router";
import { DoorOpen, RotateCcw, Trophy } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import type { Player } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";

const PODIUM_STYLE = [
  { height: "h-28", fill: "bg-brand-yellow", label: "1" },
  { height: "h-20", fill: "bg-brand-blue", label: "2" },
  { height: "h-14", fill: "bg-brand-pink", label: "3" },
];
// 시상대 배치 순서: 2등 - 1등 - 3등
const PODIUM_ORDER = [1, 0, 2];

function PodiumColumn({ player, rank }: { player: Player; rank: number }) {
  const style = PODIUM_STYLE[rank];
  return (
    <div className="flex flex-1 flex-col items-center justify-end gap-2">
      <div className="relative">
        <Avatar nickname={player.nickname} size="lg" />
        <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full border-2 border-ink bg-white text-sm font-black text-ink">
          {style.label}
        </span>
      </div>
      <div className="text-center">
        <div className="max-w-24 truncate text-sm font-extrabold text-ink">{player.nickname}</div>
        <div className="text-xs font-black text-muted-foreground tabular-nums">{player.score.toLocaleString()}점</div>
      </div>
      <div className={cn("w-full rounded-t-lg border-[3px] border-b-0 border-ink", style.fill, style.height)} />
    </div>
  );
}

export function ResultScreen() {
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const players = useGameStore((s) => s.players);

  const ranking = [...players].sort((a, b) => b.score - a.score);
  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <div className="brutal-bg flex min-h-svh items-center justify-center p-4">
      <main className="w-full max-w-lg rounded-2xl border-[3px] border-ink bg-white p-7 shadow-hard-lg">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-14 -rotate-6 items-center justify-center rounded-xl border-[3px] border-ink bg-brand-yellow shadow-hard">
            <Trophy className="size-7 text-ink" strokeWidth={2.5} />
          </span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-ink">게임 종료!</h1>
          <p className="text-sm font-bold text-muted-foreground">최종 순위 발표</p>
        </div>

        <div className="mt-8 flex items-end gap-3 border-b-[3px] border-ink pb-0">
          {PODIUM_ORDER.map((rank) =>
            podium[rank] ? (
              <PodiumColumn key={podium[rank].id} player={podium[rank]} rank={rank} />
            ) : (
              <div key={rank} className="flex-1" />
            ),
          )}
        </div>

        {rest.length > 0 && (
          <ul className="mt-6 space-y-2">
            {rest.map((player, index) => (
              <li key={player.id} className="flex items-center gap-3 rounded-xl border-2 border-ink bg-white px-3 py-2">
                <span className="w-5 text-center text-base font-black text-ink tabular-nums">{index + 4}</span>
                <Avatar nickname={player.nickname} size="sm" />
                <span className="flex-1 truncate text-sm font-extrabold text-ink">{player.nickname}</span>
                <span className="text-sm font-black text-muted-foreground tabular-nums">
                  {player.score.toLocaleString()}점
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex gap-3">
          <Button size="lg" variant="green" onClick={() => navigate(`/room/${code}`)} className="flex-1 text-base">
            <RotateCcw strokeWidth={2.5} />
            다시 하기
          </Button>
          <Button size="lg" variant="default" onClick={() => navigate("/")}>
            <DoorOpen strokeWidth={2.5} />
            나가기
          </Button>
        </div>
      </main>
    </div>
  );
}
