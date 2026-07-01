import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Clock, DoorOpen, Pencil } from "lucide-react";

import { CanvasBoard } from "@/components/game/CanvasBoard";
import { ChatPanel } from "@/components/game/ChatPanel";
import { Confetti } from "@/components/game/Confetti";
import { PlayerList } from "@/components/game/PlayerList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/hooks/useSocket";
import { disconnectSocket } from "@/lib/socket";
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
  const navigate = useNavigate();
  const { socket } = useSocket();

  const room = useRoomStore((s) => s.room);
  const resetRoom = useRoomStore((s) => s.reset);
  const resetGame = useGameStore((s) => s.reset);
  const { phase, round, totalRounds, drawerId, wordLength, duration, deadline, myWord, correctIds, turnKey } =
    useGameStore();
  const setMyWord = useGameStore((s) => s.setMyWord);

  const correctFlash = useGameStore((s) => s.correctFlash);
  const [timeLeft, setTimeLeft] = useState(0);
  const [wordDraft, setWordDraft] = useState("");
  const [showCorrect, setShowCorrect] = useState(false);

  const isDrawer = socket.id === drawerId;

  useEffect(() => {
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

  // 본인이 정답을 맞히면 "정답!" 오버레이를 잠깐 띄운다.
  useEffect(() => {
    if (correctFlash === 0) return;
    setShowCorrect(true);
    const id = setTimeout(() => setShowCorrect(false), 1500);
    return () => clearTimeout(id);
  }, [correctFlash]);

  const players = (room?.players ?? []).map((p) => ({
    ...p,
    isHost: p.id === room?.hostId,
    isDrawing: p.id === drawerId,
    hasGuessed: correctIds.includes(p.id),
  }));

  const submitWord = () => {
    const word = wordDraft.trim();
    if (!word) return;
    socket.emit("game:set-word", { word });
    setMyWord(word);
    setWordDraft("");
  };

  const handleLeave = () => {
    disconnectSocket();
    resetGame();
    resetRoom();
    navigate("/");
  };

  const urgent = timeLeft <= 10;
  const progress = duration > 0 ? (timeLeft / duration) * 100 : 0;

  return (
    <div className="brutal-bg h-svh overflow-hidden p-4">
      {showCorrect && (
        <>
          <Confetti />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
            <span className="animate-in zoom-in-50 fade-in rotate-[-4deg] rounded-2xl border-[4px] border-ink bg-brand-green px-10 py-5 text-5xl font-black text-ink shadow-hard-lg duration-300">
              정답!
            </span>
          </div>
        </>
      )}
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
            {phase === "drawing" ? (
              <CanvasBoard key={turnKey} canDraw={isDrawer} />
            ) : (
              <WaitingPanel
                isDrawer={isDrawer && phase === "selecting"}
                wordDraft={wordDraft}
                setWordDraft={setWordDraft}
                submitWord={submitWord}
              />
            )}
          </section>

          <aside className="flex min-h-[340px] flex-col rounded-xl border-[3px] border-ink bg-white p-3 shadow-hard md:min-h-0">
            <ChatPanel canGuess={!isDrawer} />
          </aside>
        </div>

        <button
          type="button"
          onClick={handleLeave}
          className="mx-auto flex shrink-0 items-center gap-1.5 border-2 border-ink bg-white px-3 py-1 text-sm font-black text-ink shadow-[2px_2px_0_0_var(--color-ink)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          <DoorOpen className="size-4" strokeWidth={2.5} />방 나가기
        </button>
      </div>
    </div>
  );
}

/** 그리기 전(단어 선택) 화면: 출제자는 단어 입력, 나머지는 대기 안내. */
function WaitingPanel({
  isDrawer,
  wordDraft,
  setWordDraft,
  submitWord,
}: {
  isDrawer: boolean;
  wordDraft: string;
  setWordDraft: (v: string) => void;
  submitWord: () => void;
}) {
  return (
    <div className="flex h-full min-h-[340px] flex-col items-center justify-center rounded-xl border-[3px] border-ink bg-white p-6 text-center shadow-hard-lg">
      <span className="mb-4 flex size-14 -rotate-6 items-center justify-center rounded-xl border-[3px] border-ink bg-brand-yellow shadow-hard">
        <Pencil className="size-7 text-ink" strokeWidth={2.5} />
      </span>
      {isDrawer ? (
        <>
          <p className="mb-4 text-lg font-black text-ink">그릴 제시어를 정해 주세요!</p>
          <form
            className="flex w-full max-w-xs gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitWord();
            }}
          >
            <Input
              value={wordDraft}
              onChange={(e) => setWordDraft(e.target.value)}
              placeholder="예: 고양이"
              autoComplete="off"
              autoFocus
            />
            <Button type="submit" variant="green">
              결정
            </Button>
          </form>
        </>
      ) : (
        <p className="text-lg font-black text-ink">출제자가 제시어를 고르고 있어요…</p>
      )}
    </div>
  );
}
