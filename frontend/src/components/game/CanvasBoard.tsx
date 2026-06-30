import { useState } from "react";
import { Eraser, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLORS = [
  "#15110d",
  "#ff5c5c",
  "#ff8a3d",
  "#ffd23f",
  "#2bd46b",
  "#4da3ff",
  "#b388ff",
  "#ff5da2",
  "#8b5e3c",
  "#ffffff",
];

const BRUSH_SIZES = [4, 8, 14, 22];

interface CanvasBoardProps {
  /** 출제자만 도구를 쓸 수 있다. 추측자에겐 도구를 숨긴다. */
  canDraw: boolean;
}

export function CanvasBoard({ canDraw }: CanvasBoardProps) {
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(BRUSH_SIZES[1]);
  const [erasing, setErasing] = useState(false);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative flex-1 overflow-hidden rounded-xl border-[3px] border-ink bg-white shadow-hard-lg">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-bold text-muted-foreground">
          {canDraw
            ? "여기에 제시어를 그려 줘! (그리기 연결은 다음 단계)"
            : "출제자가 그리는 그림이 실시간으로 나타납니다"}
        </div>
      </div>

      {canDraw && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-[3px] border-ink bg-white p-3 shadow-hard">
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`색상 ${c}`}
                aria-pressed={!erasing && color === c}
                onClick={() => {
                  setColor(c);
                  setErasing(false);
                }}
                className={cn(
                  "size-7 rounded-md border-2 border-ink transition-transform hover:-translate-y-0.5",
                  !erasing && color === c && "ring-2 ring-ink ring-offset-2",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="h-9 w-0.5 bg-ink" />

          <div className="flex items-center gap-1.5">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`굵기 ${s}`}
                aria-pressed={size === s}
                onClick={() => setSize(s)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md border-2 border-ink bg-white transition-transform hover:-translate-y-0.5",
                  size === s && "bg-brand-yellow",
                )}
              >
                <span className="rounded-full bg-ink" style={{ width: s, height: s }} />
              </button>
            ))}
          </div>

          <div className="h-9 w-0.5 bg-ink" />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon-sm"
              variant={erasing ? "yellow" : "default"}
              aria-label="지우개"
              aria-pressed={erasing}
              onClick={() => setErasing((v) => !v)}
            >
              <Eraser strokeWidth={2.5} />
            </Button>
            <Button type="button" size="icon-sm" aria-label="실행 취소">
              <Undo2 strokeWidth={2.5} />
            </Button>
            <Button type="button" size="icon-sm" variant="danger" aria-label="전체 지우기">
              <Trash2 strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
