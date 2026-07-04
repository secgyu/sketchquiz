import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";

import { LoadingOverlay } from "@/components/LoadingOverlay";
import {
  PLAYER_OPTIONS,
  ROUND_OPTIONS,
  RoomOptionsForm,
  TIME_OPTIONS,
  type RoomOptionsValue,
} from "@/components/RoomOptionsForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDelayedVisible } from "@/hooks/useDelayedVisible";
import { useSocket } from "@/hooks/useSocket";
import type { CreateRoomOptions } from "@/lib/socket";
import { useAuthStore } from "@/store/authStore";
import { useRoomStore } from "@/store/roomStore";

const CREATE_TIMEOUT_MS = 8000;

export function CreateRoomScreen() {
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const user = useAuthStore((s) => s.user);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [options, setOptions] = useState<RoomOptionsValue>({
    name: "",
    isPublic: true,
    rounds: ROUND_OPTIONS[0],
    seconds: TIME_OPTIONS[1],
    maxPlayers: PLAYER_OPTIONS[2],
  });
  const patchOptions = (patch: Partial<RoomOptionsValue>) => setOptions((prev) => ({ ...prev, ...patch }));
  const [error, setError] = useState("");
  // 생성 요청 진행 여부. ack(응답 콜백)가 오거나 타임아웃되면 해제된다.
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  // 로딩 오버레이는 "지연 표시 + 최소 유지"로 깜빡임을 막는다(빠르면 아예 안 뜸).
  const showOverlay = useDelayedVisible(creating);

  const stopCreating = () => {
    creatingRef.current = false;
    setCreating(false);
  };

  const handleCreate = () => {
    if (creating) return;
    setError("");
    creatingRef.current = true;
    setCreating(true);

    const payload: CreateRoomOptions = {
      name: options.name.trim() || undefined,
      isPublic: options.isPublic,
      maxPlayers: options.maxPlayers,
      totalRounds: options.rounds,
      roundSeconds: options.seconds,
    };

    // ack(요청-응답) + 타임아웃 표준 패턴. 응답이 없으면 err가 채워진다.
    socket.timeout(CREATE_TIMEOUT_MS).emit("room:create", payload, (err, room) => {
      if (!creatingRef.current) return; // 이미 취소/언마운트됨
      stopCreating();
      if (err || !room) {
        setError("방 만들기에 실패했어요. 연결 상태를 확인하고 다시 시도해 주세요.");
        return;
      }
      setRoom(room);
      navigate(`/room/${room.code}`);
    });
  };

  return (
    <div className="brutal-bg flex min-h-svh items-center justify-center p-4">
      {showOverlay && <LoadingOverlay message={connected ? "방 생성 중…" : "서버에 연결 중…"} />}
      <Card as="main" className="w-full max-w-md p-7">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="press flex size-10 items-center justify-center rounded-xl border-[3px] border-ink bg-white text-ink"
          >
            <ArrowLeft strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-black tracking-tight text-ink">방 만들기</h1>
        </div>

        <div className="mt-6 space-y-5">
          <RoomOptionsForm
            value={options}
            onChange={patchOptions}
            namePlaceholder={`${user?.username ?? "나"}님의 방`}
          />

          {error && (
            <p
              role="alert"
              className="border-2 border-ink bg-brand-red px-3 py-2 text-sm font-bold text-ink shadow-hard"
            >
              {error}
            </p>
          )}

          <Button size="lg" variant="pink" onClick={handleCreate} disabled={creating} className="w-full text-white">
            <Sparkles strokeWidth={2.5} />방 만들기
          </Button>
        </div>
      </Card>
    </div>
  );
}
