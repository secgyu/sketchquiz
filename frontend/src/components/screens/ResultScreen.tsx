import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { DoorOpen, RotateCcw, Share2, Trophy } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { useLeaveRoom } from "@/hooks/useLeaveRoom";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { Player } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";
import { toast } from "@/store/toastStore";

const PODIUM_STYLE = [
  { height: "h-28", fill: "bg-brand-yellow", label: "1" },
  { height: "h-20", fill: "bg-brand-blue", label: "2" },
  { height: "h-14", fill: "bg-brand-pink", label: "3" },
];
// 시상대 배치 순서: 2등 - 1등 - 3등
const PODIUM_ORDER = [1, 0, 2];

/** 0 → target 로 부드럽게(easeOutCubic) 세는 카운트업. 결과 점수 연출용. */
function useCountUp(target: number, durationMs = 900) {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduced) {
      setValue(target); // 동작 줄이기: 애니메이션 없이 최종 점수 즉시 표시
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduced]);
  return value;
}

function PodiumColumn({ player, rank }: { player: Player; rank: number }) {
  const style = PODIUM_STYLE[rank];
  const reduced = usePrefersReducedMotion();
  const score = useCountUp(player.score);
  const [grown, setGrown] = useState(reduced);
  useEffect(() => {
    if (reduced) return setGrown(true); // 동작 줄이기: 바를 바로 세운다
    // 1등부터 순서대로 살짝 늦게 자라도록 랭크별 지연
    const id = setTimeout(() => setGrown(true), 120 + rank * 140);
    return () => clearTimeout(id);
  }, [rank, reduced]);

  return (
    <div className="flex flex-1 flex-col items-center justify-end gap-2">
      <div className="animate-in zoom-in-75 fade-in relative duration-500">
        <Avatar nickname={player.nickname} avatar={player.avatar} size="lg" />
        <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full border-2 border-ink bg-white text-sm font-black text-ink">
          {style.label}
        </span>
      </div>
      <div className="text-center">
        <div className="max-w-24 truncate text-sm font-extrabold text-ink">{player.nickname}</div>
        <div className="text-xs font-black text-muted-foreground tabular-nums">{score.toLocaleString()}점</div>
      </div>
      <div
        className={cn(
          "w-full origin-bottom rounded-t-lg border-[3px] border-b-0 border-ink transition-transform duration-700 ease-out",
          style.fill,
          style.height,
          grown ? "scale-y-100" : "scale-y-0",
        )}
      />
    </div>
  );
}

function RestRow({ player, rank, delayMs }: { player: Player; rank: number; delayMs: number }) {
  const score = useCountUp(player.score);
  return (
    <li
      className="animate-in fade-in slide-in-from-bottom-2 flex items-center gap-3 rounded-xl border-2 border-ink bg-white px-3 py-2 duration-300"
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "both" }}
    >
      <span className="w-5 text-center text-base font-black text-ink tabular-nums">{rank}</span>
      <Avatar nickname={player.nickname} avatar={player.avatar} size="sm" />
      <span className="flex-1 truncate text-sm font-extrabold text-ink">{player.nickname}</span>
      <span className="text-sm font-black text-muted-foreground tabular-nums">{score.toLocaleString()}점</span>
    </li>
  );
}

export function ResultScreen() {
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const ranking = useGameStore((s) => s.ranking);

  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  const leaveRoom = useLeaveRoom();

  const handleShare = async () => {
    const lines = ranking.map(
      (p, i) => `${i + 1}. ${p.avatar ? p.avatar + " " : ""}${p.nickname} — ${p.score}점`,
    );
    const url = `${window.location.origin}/room/${code}`;
    const text = `🏆 SketchQuiz 결과\n${lines.join("\n")}\n\n같이 하기 👉 ${url}`;
    try {
      // 모바일 등 네이티브 공유 시트가 있으면 우선 사용, 없으면 클립보드로 대체한다.
      if (navigator.share) await navigator.share({ title: "SketchQuiz 결과", text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("결과를 클립보드에 복사했어요!");
      }
    } catch {
      // 사용자가 공유를 취소한 경우 등은 조용히 무시한다.
    }
  };

  return (
    <div className="brutal-bg flex min-h-svh items-center justify-center p-4">
      <main className="w-full max-w-lg rounded-2xl border-[3px] border-ink bg-white p-7 shadow-hard-lg">
        <div className="flex flex-col items-center text-center">
          <span className="animate-in zoom-in-50 fade-in flex size-14 -rotate-6 items-center justify-center rounded-xl border-[3px] border-ink bg-brand-yellow shadow-hard duration-500">
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
              <RestRow key={player.id} player={player} rank={index + 4} delayMs={500 + index * 80} />
            ))}
          </ul>
        )}

        <div className="mt-8 flex gap-3">
          <Button size="lg" variant="green" onClick={() => navigate(`/room/${code}`)} className="flex-1 text-base">
            <RotateCcw strokeWidth={2.5} />
            다시 하기
          </Button>
          <Button size="lg" variant="blue" onClick={handleShare} aria-label="결과 공유">
            <Share2 strokeWidth={2.5} />
          </Button>
          <Button size="lg" variant="default" onClick={leaveRoom} aria-label="나가기">
            <DoorOpen strokeWidth={2.5} />
          </Button>
        </div>
      </main>
    </div>
  );
}
