import { useState } from "react";
import { useNavigate } from "react-router";
import { Pencil } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateRoomCode } from "@/lib/mock";
import { useGameStore } from "@/store/gameStore";

export function StartScreen() {
  const navigate = useNavigate();
  const nickname = useGameStore((s) => s.nickname);
  const setNickname = useGameStore((s) => s.setNickname);

  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const canStart = nickname.trim().length > 0;

  const handleCreate = () => {
    if (!canStart) return setError("닉네임을 먼저 입력해 줘!");
    navigate(`/room/${generateRoomCode()}`);
  };

  const handleJoin = () => {
    if (!canStart) return setError("닉네임을 먼저 입력해 줘!");
    if (roomCode.trim().length < 4) return setError("방 코드 4자리를 입력해 줘!");
    navigate(`/room/${roomCode.trim()}`);
  };

  return (
    <div className="brutal-bg flex min-h-svh items-center justify-center p-4">
      <main className="w-full max-w-md rounded-2xl border-[3px] border-ink bg-white p-7 shadow-hard-lg">
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 flex size-16 -rotate-6 items-center justify-center rounded-xl border-[3px] border-ink bg-brand-yellow text-ink shadow-hard">
            <Pencil className="size-8" strokeWidth={2.5} />
          </span>
          <h1 className="text-5xl font-black tracking-tighter text-ink">
            Sketch
            <span className="ml-1 inline-block rotate-2 bg-brand-pink px-2 text-white [-webkit-text-stroke:1.5px_var(--color-ink)]">
              Quiz
            </span>
          </h1>
          <p className="mt-3 inline-block -rotate-1 border-2 border-ink bg-brand-blue px-3 py-1 text-sm font-bold text-ink">
            그리고 · 맞히고 · 다 같이 논다
          </p>
        </div>

        <div className="mt-8 space-y-5">
          <div className="space-y-2">
            <label htmlFor="nickname" className="text-sm font-black uppercase tracking-wide">
              닉네임
            </label>
            <div className="flex items-center gap-3">
              {nickname.trim() && <Avatar nickname={nickname} />}
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setError("");
                }}
                maxLength={12}
                placeholder="이름을 입력해!"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="roomCode" className="text-sm font-black uppercase tracking-wide">
              방 코드로 입장
            </label>
            <div className="flex gap-2">
              <Input
                id="roomCode"
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase());
                  setError("");
                }}
                maxLength={4}
                placeholder="AB7K"
                autoComplete="off"
                className="font-mono text-lg font-black tracking-[0.3em] uppercase"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <Button size="lg" variant="blue" onClick={handleJoin}>
                입장
              </Button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="border-2 border-ink bg-brand-red px-3 py-2 text-sm font-bold text-ink shadow-hard"
            >
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs font-black uppercase">
            <span className="h-0.5 flex-1 bg-ink" />
            또는
            <span className="h-0.5 flex-1 bg-ink" />
          </div>

          <Button size="lg" variant="pink" onClick={handleCreate} className="w-full text-white">
            새 방 만들기
          </Button>
        </div>
      </main>
    </div>
  );
}
