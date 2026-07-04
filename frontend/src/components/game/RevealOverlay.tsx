import { Card } from "@/components/ui/card";
import type { TurnReveal } from "@/store/gameStore";

/** 턴 종료 시 정답과 현재 점수판 상위권을 잠깐 공개하는 오버레이. */
export function RevealOverlay({ reveal }: { reveal: TurnReveal }) {
  return (
    <div
      role="status"
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm duration-200"
    >
      <Card className="animate-in zoom-in-95 w-full max-w-sm p-6 text-center duration-200">
        <p className="text-sm font-black uppercase text-muted-foreground">정답 공개</p>
        <p className="mt-1 -rotate-1 text-4xl font-black text-ink">{reveal.word}</p>
        <p className="mt-3 text-sm font-black text-ink">
          {reveal.correctGuessers.length > 0
            ? `${reveal.correctGuessers.join(", ")} 정답!`
            : "이번엔 아무도 못 맞혔어요"}
        </p>
        <div className="mt-4 space-y-1.5 text-left">
          {[...reveal.players]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((p, i) => (
              <div
                key={`${i}-${p.nickname}`}
                className="flex items-center justify-between rounded-lg border-2 border-ink bg-brand-yellow/40 px-3 py-1.5 text-sm font-black text-ink"
              >
                <span className="truncate">
                  {i + 1}. {p.nickname}
                </span>
                <span className="shrink-0 tabular-nums">{p.score}점</span>
              </div>
            ))}
        </div>
        <p className="mt-4 text-xs font-bold text-muted-foreground">잠시 후 다음 턴이 시작돼요…</p>
      </Card>
    </div>
  );
}
