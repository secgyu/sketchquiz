import { Clock, DoorOpen, Pencil } from "lucide-react";

import { CanvasBoard } from "@/components/game/CanvasBoard";
import { ChatPanel } from "@/components/game/ChatPanel";
import { CorrectFlash } from "@/components/game/CorrectFlash";
import { PlayerList } from "@/components/game/PlayerList";
import { RevealOverlay } from "@/components/game/RevealOverlay";
import { SoundToggle } from "@/components/SoundToggle";
import { Button } from "@/components/ui/button";
import { useCountdown } from "@/hooks/useCountdown";
import { useLeaveRoom } from "@/hooks/useLeaveRoom";
import { useSocket } from "@/hooks/useSocket";
import { decoratePlayers } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";
import { useRoomStore } from "@/store/roomStore";

/** 제시어를 글자 타일로 보여준다. 추측자에겐 글자 수만큼 빈 칸으로 보인다. */
function WordTiles({ length, word }: { length: number; word?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className="flex size-10 items-center justify-center rounded-lg border-[3px] border-ink bg-brand-yellow text-xl font-black text-ink shadow-[2px_2px_0_0_var(--color-ink)]"
        >
          {word?.[i] ?? ""}
        </span>
      ))}
      <span className="ml-1.5 text-sm font-black text-ink">{length}글자</span>
    </div>
  );
}

export function GameScreen() {
  const { socket } = useSocket();

  const room = useRoomStore((s) => s.room);
  const { phase, round, totalRounds, drawerId, wordLength, duration, deadline, myWord, choices, correctIds, turnKey } =
    useGameStore();
  const setMyWord = useGameStore((s) => s.setMyWord);

  const correctFlash = useGameStore((s) => s.correctFlash);
  const reveal = useGameStore((s) => s.reveal);
  const timeLeft = useCountdown(deadline);
  const leaveRoom = useLeaveRoom();

  const isDrawer = socket.id === drawerId;

  const players = decoratePlayers(room?.players ?? [], {
    hostId: room?.hostId,
    drawerId,
    correctIds,
  });

  const pickWord = (word: string) => {
    if (myWord) return; // 이미 골랐으면 중복 전송 방지
    socket.emit("game:set-word", { word });
    setMyWord(word);
  };

  const urgent = timeLeft <= 10;
  const progress = duration > 0 ? (timeLeft / duration) * 100 : 0;

  return (
    <div className="brutal-bg h-svh overflow-hidden p-4">
      <CorrectFlash trigger={correctFlash} />
      {reveal && <RevealOverlay reveal={reveal} />}
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-[3px] border-ink bg-white px-4 py-3 shadow-hard">
          <div className="rounded-lg border-2 border-ink bg-brand-purple px-3 py-1.5 text-sm font-black text-ink">
            라운드 {round} / {totalRounds}
          </div>

          {phase === "drawing" ? (
            <WordTiles length={isDrawer ? myWord.length : wordLength} word={isDrawer ? myWord : undefined} />
          ) : (
            <div className="text-sm font-black text-ink">출제자가 제시어를 고르는 중…</div>
          )}

          <div className="flex items-center gap-3">
            <SoundToggle />
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 border-ink px-3 py-1.5",
                urgent ? "bg-brand-red" : "bg-brand-green",
              )}
            >
              <Clock className="size-5 text-ink" strokeWidth={2.5} />
              <span className="w-7 text-xl font-black text-ink tabular-nums">{timeLeft}</span>
            </div>
          </div>
        </header>

        <div className="h-3 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-white">
          <div
            className={cn(
              "h-full transition-[width] duration-300 ease-linear",
              urgent ? "bg-brand-red" : "bg-brand-pink",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden md:grid md:grid-cols-[230px_1fr_320px] md:gap-4">
          <aside className="flex shrink-0 flex-col rounded-xl border-[3px] border-ink bg-white p-3 shadow-hard md:min-h-0">
            <h2 className="mb-2 inline-block self-start -rotate-1 border-2 border-ink bg-brand-blue px-2 py-0.5 text-xs font-black uppercase text-ink">
              플레이어 {players.length}
            </h2>
            {/* 데스크톱: 세로 목록 / 모바일: 가로 스트립(공간 절약, 캔버스 우선) */}
            <div className="thin-scroll hidden min-h-0 flex-1 overflow-y-auto pr-1 md:block">
              <PlayerList players={players} ranked />
            </div>
            <div className="md:hidden">
              <PlayerList players={players} ranked variant="strip" />
            </div>
          </aside>

          <section className="h-[44svh] shrink-0 md:h-auto md:min-h-0">
            {phase === "drawing" ? (
              <CanvasBoard key={turnKey} canDraw={isDrawer} />
            ) : (
              <WaitingPanel isDrawer={isDrawer && phase === "selecting"} choices={choices} onPick={pickWord} />
            )}
          </section>

          <aside className="flex min-h-0 flex-1 flex-col rounded-xl border-[3px] border-ink bg-white p-3 shadow-hard md:flex-none md:min-h-0">
            <ChatPanel canGuess={!isDrawer} />
          </aside>
        </div>

        <button
          type="button"
          onClick={leaveRoom}
          className="mx-auto flex shrink-0 items-center gap-1.5 border-2 border-ink bg-white px-3 py-1 text-sm font-black text-ink shadow-[2px_2px_0_0_var(--color-ink)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          <DoorOpen className="size-4" strokeWidth={2.5} />방 나가기
        </button>
      </div>
    </div>
  );
}

/** 그리기 전(단어 선택) 화면: 출제자는 3지선다에서 하나 선택, 나머지는 대기 안내. */
function WaitingPanel({
  isDrawer,
  choices,
  onPick,
}: {
  isDrawer: boolean;
  choices: string[];
  onPick: (w: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border-[3px] border-ink bg-white p-6 text-center shadow-hard-lg">
      <span className="mb-4 flex size-14 -rotate-6 items-center justify-center rounded-xl border-[3px] border-ink bg-brand-yellow shadow-hard">
        <Pencil className="size-7 text-ink" strokeWidth={2.5} />
      </span>
      {isDrawer ? (
        <>
          <p className="mb-4 text-lg font-black text-ink">그릴 제시어를 골라 주세요!</p>
          <div className="flex w-full max-w-xs flex-col gap-3">
            {choices.length === 0 ? (
              <p className="text-sm font-bold text-muted-foreground">후보를 불러오는 중…</p>
            ) : (
              choices.map((word) => (
                <Button
                  key={word}
                  type="button"
                  variant="yellow"
                  className="w-full text-lg"
                  onClick={() => onPick(word)}
                >
                  {word}
                </Button>
              ))
            )}
          </div>
        </>
      ) : (
        <p className="text-lg font-black text-ink">출제자가 제시어를 고르고 있어요…</p>
      )}
    </div>
  );
}
