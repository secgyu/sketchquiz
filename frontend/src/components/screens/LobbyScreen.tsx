import { useState, type ReactNode } from "react";
import { Check, Clock, Copy, DoorOpen, Hash, Play, Users } from "lucide-react";

import { PlayerList } from "@/components/game/PlayerList";
import { Button } from "@/components/ui/button";
import { MOCK_ROUND_SECONDS, MOCK_TOTAL_ROUNDS } from "@/lib/mock";
import { useGameStore } from "@/store/gameStore";

function SettingItem({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl border-2 border-ink ${color} px-3 py-2 shadow-[2px_2px_0_0_var(--color-ink)]`}>
      <div className="flex items-center gap-1 text-xs font-bold text-ink">
        {icon}
        {label}
      </div>
      <div className="text-lg font-black text-ink">{value}</div>
    </div>
  );
}

export function LobbyScreen() {
  const roomCode = useGameStore((s) => s.roomCode);
  const players = useGameStore((s) => s.players);
  const startGame = useGameStore((s) => s.startGame);
  const leave = useGameStore((s) => s.leave);
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="brutal-bg flex min-h-svh items-center justify-center p-4">
      <main className="w-full max-w-lg rounded-2xl border-[3px] border-ink bg-white p-7 shadow-hard-lg">
        <div className="text-center">
          <h1 className="inline-block -rotate-1 text-3xl font-black tracking-tight text-ink">
            대기실
          </h1>
          <p className="mt-1 text-sm font-bold text-muted-foreground">
            친구에게 코드를 공유하고 다 같이 시작!
          </p>
        </div>

        <button
          type="button"
          onClick={copyCode}
          className="press mt-6 flex w-full items-center justify-center gap-3 rounded-xl border-[3px] border-ink bg-brand-yellow py-4"
        >
          <span className="font-mono text-4xl font-black tracking-[0.35em] text-ink">
            {roomCode}
          </span>
          {copied ? (
            <Check className="size-6 text-ink" strokeWidth={3} />
          ) : (
            <Copy className="size-6 text-ink" strokeWidth={2.5} />
          )}
        </button>
        <p className="mt-2 text-center text-xs font-black uppercase text-ink">
          {copied ? "복사 완료!" : "코드를 눌러 복사"}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2.5">
          <SettingItem icon={<Hash className="size-3.5" strokeWidth={2.5} />} label="라운드" value={`${MOCK_TOTAL_ROUNDS}회`} color="bg-brand-pink" />
          <SettingItem icon={<Clock className="size-3.5" strokeWidth={2.5} />} label="시간" value={`${MOCK_ROUND_SECONDS}초`} color="bg-brand-blue" />
          <SettingItem icon={<Users className="size-3.5" strokeWidth={2.5} />} label="인원" value={`${players.length}명`} color="bg-brand-green" />
        </div>

        <div className="mt-6">
          <h2 className="mb-2 inline-block self-start -rotate-1 border-2 border-ink bg-brand-purple px-2 py-0.5 text-xs font-black uppercase text-ink">
            참가자 {players.length}
          </h2>
          <PlayerList players={players} showStatus={false} />
        </div>

        <Button size="lg" variant="green" onClick={startGame} className="mt-6 w-full text-lg">
          <Play className="fill-ink" strokeWidth={2.5} />
          게임 시작
        </Button>

        <button
          type="button"
          onClick={leave}
          className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-black text-muted-foreground transition-colors hover:text-ink"
        >
          <DoorOpen className="size-4" strokeWidth={2.5} />
          나가기
        </button>
      </main>
    </div>
  );
}
