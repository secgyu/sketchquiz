import { Check, Crown, Pencil } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import type { PlayerView } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PlayerListProps {
  players: PlayerView[];
  ranked?: boolean;
  showStatus?: boolean;
  /** "list": 세로 목록(기본). "strip": 모바일용 가로 스크롤 칩. */
  variant?: "list" | "strip";
}

export function PlayerList({ players, ranked = false, showStatus = true, variant = "list" }: PlayerListProps) {
  const ordered = ranked ? [...players].sort((a, b) => b.score - a.score) : players;

  if (variant === "strip") {
    return (
      <ul className="thin-scroll flex gap-2 overflow-x-auto pb-1">
        {ordered.map((player) => (
          <li
            key={player.id}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg border-2 border-ink px-2 py-1",
              player.isDrawing ? "bg-brand-yellow" : player.hasGuessed ? "bg-brand-green" : "bg-white",
              player.connected === false && "opacity-40",
            )}
          >
            <Avatar nickname={player.nickname} avatar={player.avatar} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-0.5">
                <span className="max-w-[72px] truncate text-xs font-extrabold text-ink">{player.nickname}</span>
                {player.isHost && <Crown className="size-3 shrink-0 text-ink" aria-label="방장" />}
              </div>
              <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                {player.score.toLocaleString()}점
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {ordered.map((player, index) => (
        <li
          key={player.id}
          className={cn(
            "flex items-center gap-3 rounded-xl border-2 border-ink px-2.5 py-2",
            "bg-white",
            showStatus && player.isDrawing && "bg-brand-yellow",
            showStatus && player.hasGuessed && !player.isDrawing && "bg-brand-green",
            player.connected === false && "opacity-40", // 접속 끊김(재접속 대기)
          )}
        >
          {ranked && <span className="w-5 text-center text-base font-black text-ink tabular-nums">{index + 1}</span>}
          <Avatar nickname={player.nickname} avatar={player.avatar} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-extrabold text-ink">{player.nickname}</span>
              {player.isHost && <Crown className="size-4 shrink-0 text-ink" aria-label="방장" />}
            </div>
            <span className="text-xs font-bold text-muted-foreground tabular-nums">
              {player.score.toLocaleString()}점
            </span>
          </div>
          {showStatus && player.isDrawing && (
            <Pencil className="size-5 shrink-0 text-ink" strokeWidth={2.5} aria-label="그리는 중" />
          )}
          {showStatus && player.hasGuessed && !player.isDrawing && (
            <Check className="size-5 shrink-0 text-ink" strokeWidth={3} aria-label="정답 맞힘" />
          )}
        </li>
      ))}
    </ul>
  );
}
