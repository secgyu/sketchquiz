import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, Clock, Copy, DoorOpen, Hash, Pencil, Play, Users } from "lucide-react";

import { PlayerList } from "@/components/game/PlayerList";
import { RoomOptionsForm, type RoomOptionsValue } from "@/components/RoomOptionsForm";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/hooks/useSocket";
import { DEFAULT_ROUND_SECONDS, DEFAULT_TOTAL_ROUNDS } from "@/lib/mock";
import { disconnectSocket, type CreateRoomOptions } from "@/lib/socket";
import { useRoomStore } from "@/store/roomStore";

function SettingItem({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color: string }) {
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
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const { socket } = useSocket();
  const room = useRoomStore((s) => s.room);
  const error = useRoomStore((s) => s.error);
  const resetRoom = useRoomStore((s) => s.reset);
  const [copied, setCopied] = useState(false);

  const isHost = !!room && socket.id === room.hostId;
  // 서버 플레이어(id·nickname·score)를 화면용 형태로 변환한다(방장 왕관은 hostId로 판별).
  const players = (room?.players ?? []).map((p) => ({
    ...p,
    isHost: p.id === room?.hostId,
    isDrawing: false,
    hasGuessed: false,
  }));

  // 방장 설정 편집: 열 때 현재 방 설정을 초안으로 복사한다.
  const [draft, setDraft] = useState<RoomOptionsValue | null>(null);
  const patchDraft = (patch: Partial<RoomOptionsValue>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const openEdit = () => {
    if (!room) return;
    setDraft({
      name: room.name,
      isPublic: room.isPublic,
      rounds: room.totalRounds,
      seconds: room.roundSeconds,
      maxPlayers: room.maxPlayers,
    });
  };

  const saveEdit = () => {
    if (!draft) return;
    const payload: CreateRoomOptions = {
      name: draft.name.trim() || undefined,
      isPublic: draft.isPublic,
      maxPlayers: draft.maxPlayers,
      totalRounds: draft.rounds,
      roundSeconds: draft.seconds,
    };
    // 성공 시 서버가 room:state를 브로드캐스트하므로 낙관적으로 닫는다(실패는 room:error 토스트).
    socket.emit("room:update", payload);
    setDraft(null);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleLeave = () => {
    // 서버는 소켓 연결 종료로 방 퇴장을 처리한다(별도 leave 이벤트 없음).
    disconnectSocket();
    resetRoom();
    navigate("/");
  };

  return (
    <div className="brutal-bg flex min-h-svh items-center justify-center p-4">
      <main className="w-full max-w-lg rounded-2xl border-[3px] border-ink bg-white p-7 shadow-hard-lg">
        <div className="text-center">
          <h1 className="inline-block -rotate-1 text-3xl font-black tracking-tight text-ink">
            {room?.name ?? "대기실"}
          </h1>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-bold text-muted-foreground">
            <span
              className={`inline-block rounded border-2 border-ink px-1.5 py-0.5 text-[11px] font-black text-ink ${
                room?.isPublic ? "bg-brand-green" : "bg-brand-blue"
              }`}
            >
              {room?.isPublic ? "공개방" : "비공개방"}
            </span>
            친구에게 코드를 공유하고 다 같이 시작!
          </p>
        </div>

        <button
          type="button"
          onClick={copyCode}
          className="press mt-6 flex w-full items-center justify-center gap-3 rounded-xl border-[3px] border-ink bg-brand-yellow py-4"
        >
          <span className="font-mono text-4xl font-black tracking-[0.35em] text-ink">{code}</span>
          {copied ? (
            <Check className="size-6 text-ink" strokeWidth={3} />
          ) : (
            <Copy className="size-6 text-ink" strokeWidth={2.5} />
          )}
        </button>
        <p className="mt-2 text-center text-xs font-black uppercase text-ink">
          {copied ? "복사 완료!" : "코드를 눌러 복사"}
        </p>

        {draft ? (
          <div className="mt-6 space-y-5">
            <RoomOptionsForm
              value={draft}
              onChange={patchDraft}
              minPlayers={players.length}
              namePlaceholder={room?.name}
            />
            <div className="flex gap-2">
              <Button size="lg" variant="default" onClick={() => setDraft(null)} className="flex-1">
                취소
              </Button>
              <Button size="lg" variant="green" onClick={saveEdit} className="flex-1">
                <Check strokeWidth={2.5} />
                저장
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-2.5">
              <SettingItem
                icon={<Hash className="size-3.5" strokeWidth={2.5} />}
                label="라운드"
                value={`${room?.totalRounds ?? DEFAULT_TOTAL_ROUNDS}회`}
                color="bg-brand-pink"
              />
              <SettingItem
                icon={<Clock className="size-3.5" strokeWidth={2.5} />}
                label="시간"
                value={`${room?.roundSeconds ?? DEFAULT_ROUND_SECONDS}초`}
                color="bg-brand-blue"
              />
              <SettingItem
                icon={<Users className="size-3.5" strokeWidth={2.5} />}
                label="인원"
                value={room ? `${players.length}/${room.maxPlayers}` : `${players.length}명`}
                color="bg-brand-green"
              />
            </div>
            {isHost && (
              <button
                type="button"
                onClick={openEdit}
                className="press mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-ink bg-white py-2 text-sm font-black text-ink"
              >
                <Pencil className="size-4" strokeWidth={2.5} />
                설정 편집
              </button>
            )}
          </>
        )}

        <div className="mt-6">
          <h2 className="mb-2 inline-block self-start -rotate-1 border-2 border-ink bg-brand-purple px-2 py-0.5 text-xs font-black uppercase text-ink">
            참가자 {players.length}
          </h2>
          <PlayerList players={players} showStatus={false} />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 border-2 border-ink bg-brand-red px-3 py-2 text-center text-sm font-bold text-ink shadow-hard"
          >
            {error}
          </p>
        )}

        {!draft &&
          (isHost ? (
            <Button size="lg" variant="green" onClick={() => socket.emit("game:start")} className="mt-6 w-full text-lg">
              <Play className="fill-ink" strokeWidth={2.5} />
              게임 시작
            </Button>
          ) : (
            <p className="mt-6 rounded-xl border-2 border-ink bg-brand-blue px-3 py-3 text-center text-sm font-black text-ink">
              방장이 게임을 시작하길 기다리는 중…
            </p>
          ))}

        <button
          type="button"
          onClick={handleLeave}
          className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-black text-muted-foreground transition-colors hover:text-ink"
        >
          <DoorOpen className="size-4" strokeWidth={2.5} />
          나가기
        </button>
      </main>
    </div>
  );
}
