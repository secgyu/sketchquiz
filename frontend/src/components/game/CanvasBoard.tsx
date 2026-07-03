import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Eraser, Trash2 } from "lucide-react";

import { useSocket } from "@/hooks/useSocket";
import type { DrawStroke } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";

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
const ERASER_COLOR = "#ffffff"; // 배경이 흰색이므로 흰색으로 덧그려 지운다

interface CanvasBoardProps {
  /** 출제자이며 그리기 단계일 때만 그릴 수 있다. 추측자는 도구 없이 수신만 한다. */
  canDraw: boolean;
}

export function CanvasBoard({ canDraw }: CanvasBoardProps) {
  const { socket } = useSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(BRUSH_SIZES[1]);
  const [erasing, setErasing] = useState(false);

  // 좌표는 0~1로 정규화해 서로 다른 캔버스 크기 사이에서도 위치가 맞는다.
  // ponytail: 굵기(px)는 정규화하지 않아 캔버스 크기가 크게 다르면 두께가 약간 달라질 수 있다.
  const drawSegment = useCallback((s: DrawStroke) => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.x0 * c.width, s.y0 * c.height);
    ctx.lineTo(s.x1 * c.width, s.y1 * c.height);
    ctx.stroke();
  }, []);

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  }, []);

  // 캔버스 백킹 크기를 표시 크기에 맞춘다 (마운트 시 1회; 턴마다 key로 리마운트되며 초기화).
  // 재접속으로 리마운트된 경우, 서버가 보내준 지금까지의 획을 한 번 재생해 그림을 복원한다.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = c.clientWidth;
    c.height = c.clientHeight;
    useGameStore.getState().syncStrokes.forEach(drawSegment);
  }, [drawSegment]);

  useEffect(() => {
    socket.on("draw:stroke", drawSegment);
    socket.on("draw:clear", clearCanvas);
    return () => {
      socket.off("draw:stroke", drawSegment);
      socket.off("draw:clear", clearCanvas);
    };
  }, [socket, drawSegment, clearCanvas]);

  const toNorm = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const handleDown = (e: PointerEvent) => {
    if (!canDraw) return;
    drawingRef.current = true;
    lastRef.current = toNorm(e);
  };

  const handleMove = (e: PointerEvent) => {
    if (!canDraw || !drawingRef.current || !lastRef.current) return;
    const p = toNorm(e);
    const stroke: DrawStroke = {
      x0: lastRef.current.x,
      y0: lastRef.current.y,
      x1: p.x,
      y1: p.y,
      color: erasing ? ERASER_COLOR : color,
      width: size,
    };
    drawSegment(stroke);
    socket.emit("draw:stroke", stroke);
    lastRef.current = p;
  };

  const stopDrawing = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  const handleClear = () => {
    clearCanvas();
    socket.emit("draw:clear");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative flex-1 overflow-hidden rounded-xl border-[3px] border-ink bg-white shadow-hard-lg">
        <canvas
          ref={canvasRef}
          className={cn("h-full w-full touch-none", canDraw ? "cursor-crosshair" : "cursor-default")}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
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
            <Button type="button" size="icon-sm" variant="danger" aria-label="전체 지우기" onClick={handleClear}>
              <Trash2 strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
