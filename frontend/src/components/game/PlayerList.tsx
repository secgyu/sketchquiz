import { Check, Crown, Pencil } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import type { Player } from "@/lib/mock";
import { cn } from "@/lib/utils";

interface PlayerListProps {
  players: Player[];
  ranked?: boolean;
  showStatus?: boolean;
}

export function PlayerList({ players, ranked = false, showStatus = true }: PlayerListProps) {
  const ordered = ranked ? [...players].sort((a, b) => b.score - a.score) : players;

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
          )}
        >
          {ranked && <span className="w-5 text-center text-base font-black text-ink tabular-nums">{index + 1}</span>}
          <Avatar nickname={player.nickname} size="sm" />
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
