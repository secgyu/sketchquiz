import { useEffect, useRef, useState, type ComponentType } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Clock, Globe, Hash, Lock, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/hooks/useSocket";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useRoomStore } from "@/store/roomStore";

const ROUND_OPTIONS = [3, 5, 7];
const TIME_OPTIONS = [60, 80, 100];
const PLAYER_OPTIONS = [4, 6, 8];

/** 프리셋 값 중 하나를 고르는 옵션 행 */
function OptionRow({
  icon: Icon,
  label,
  options,
  value,
  unit,
  onChange,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  options: number[];
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-black text-ink">
        <Icon className="size-4" strokeWidth={2.5} />
        {label}
      </div>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={cn(
              "press flex-1 rounded-xl border-[3px] border-ink py-2.5 text-base font-black text-ink",
              value === o ? "bg-brand-yellow" : "bg-white",
            )}
          >
            {o}
            {unit}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CreateRoomScreen() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const user = useAuthStore((s) => s.user);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [rounds, setRounds] = useState(ROUND_OPTIONS[0]);
  const [seconds, setSeconds] = useState(TIME_OPTIONS[1]);
  const [maxPlayers, setMaxPlayers] = useState(PLAYER_OPTIONS[2]);
  const [error, setError] = useState("");
  // 서버가 코드를 발급한 뒤에야 대기실로 이동할 수 있으므로 응답을 기다린다.
  const creatingRef = useRef(false);

  useEffect(() => {
    const onRoomState = (state: Parameters<typeof setRoom>[0]) => {
      setRoom(state);
      if (creatingRef.current) {
        creatingRef.current = false;
        navigate(`/room/${state.code}`);
      }
    };
    const onRoomError = ({ message }: { message: string }) => {
      creatingRef.current = false;
      setError(message);
    };
    socket.on("room:state", onRoomState);
    socket.on("room:error", onRoomError);
    return () => {
      socket.off("room:state", onRoomState);
      socket.off("room:error", onRoomError);
    };
  }, [socket, setRoom, navigate]);

  const handleCreate = () => {
    setError("");
    creatingRef.current = true;
    // ponytail: 옵션(name/isPublic/rounds/seconds/maxPlayers)은 백엔드 room:create 확장 시 payload로 전달한다.
    socket.emit("room:create");
  };

  return (
    <div className="brutal-bg flex min-h-svh items-center justify-center p-4">
      <main className="w-full max-w-md rounded-2xl border-[3px] border-ink bg-white p-7 shadow-hard-lg">
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
          <div className="space-y-2">
            <label htmlFor="roomName" className="text-sm font-black text-ink">
              방 이름
            </label>
            <Input
              id="roomName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder={`${user?.username ?? "나"}님의 방`}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-black text-ink">공개 설정</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={isPublic}
                onClick={() => setIsPublic(true)}
                className={cn(
                  "press flex flex-col items-center gap-1 rounded-xl border-[3px] border-ink px-3 py-3 text-ink",
                  isPublic ? "bg-brand-green" : "bg-white",
                )}
              >
                <Globe strokeWidth={2.5} />
                <span className="text-sm font-black">공개방</span>
                <span className="text-[11px] font-bold text-ink/70">목록에서 누구나 입장</span>
              </button>
              <button
                type="button"
                aria-pressed={!isPublic}
                onClick={() => setIsPublic(false)}
                className={cn(
                  "press flex flex-col items-center gap-1 rounded-xl border-[3px] border-ink px-3 py-3 text-ink",
                  !isPublic ? "bg-brand-blue" : "bg-white",
                )}
              >
                <Lock strokeWidth={2.5} />
                <span className="text-sm font-black">비공개방</span>
                <span className="text-[11px] font-bold text-ink/70">코드 아는 사람만</span>
              </button>
            </div>
            <p className="text-xs font-bold text-muted-foreground">
              {isPublic
                ? "공개방은 코드 없이 목록에서 바로 입장할 수 있어요."
                : "비공개방은 생성 후 방 코드를 공유해야 입장할 수 있어요."}
            </p>
          </div>

          <OptionRow icon={Hash} label="라운드" options={ROUND_OPTIONS} value={rounds} unit="회" onChange={setRounds} />
          <OptionRow icon={Clock} label="라운드당 시간" options={TIME_OPTIONS} value={seconds} unit="초" onChange={setSeconds} />
          <OptionRow icon={Users} label="최대 인원" options={PLAYER_OPTIONS} value={maxPlayers} unit="명" onChange={setMaxPlayers} />

          {error && (
            <p
              role="alert"
              className="border-2 border-ink bg-brand-red px-3 py-2 text-sm font-bold text-ink shadow-hard"
            >
              {error}
            </p>
          )}

          <Button size="lg" variant="pink" onClick={handleCreate} className="w-full text-white">
            <Sparkles strokeWidth={2.5} />
            방 만들기
          </Button>
        </div>
      </main>
    </div>
  );
}
