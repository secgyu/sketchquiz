import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Compass, LogIn, LogOut, Pencil } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/hooks/useSocket";
import { useAuthStore } from "@/store/authStore";
import { useRoomStore } from "@/store/roomStore";

export function StartScreen() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { socket } = useSocket();
  const setRoom = useRoomStore((s) => s.setRoom);

  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  // 새 방 만들기는 서버가 코드를 발급한 뒤에야 이동할 수 있으므로 응답을 기다린다.
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
    socket.emit("room:create");
  };

  const handleJoin = () => {
    if (roomCode.trim().length < 4) return setError("방 코드 4자리를 입력해 줘!");
    navigate(`/room/${roomCode.trim()}`);
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
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

        {user ? (
          <div className="mt-8 space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-xl border-[3px] border-ink bg-brand-yellow px-4 py-3 shadow-hard">
              <div className="flex items-center gap-3">
                <Avatar nickname={user.username} />
                <div className="text-left">
                  <p className="text-xs font-bold text-ink/70">반가워요</p>
                  <p className="text-lg font-black text-ink">{user.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="로그아웃"
                className="press flex size-10 items-center justify-center rounded-lg border-[3px] border-ink bg-white text-ink"
              >
                <LogOut className="size-5" strokeWidth={2.5} />
              </button>
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

            <Button size="lg" variant="purple" onClick={() => navigate("/rooms")} className="w-full">
              <Compass strokeWidth={2.5} />
              공개방 둘러보기
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <p className="text-center text-sm font-bold text-ink/70">
              로그인하면 방을 만들고 친구와 함께 놀 수 있어요!
            </p>
            <Button size="lg" variant="green" onClick={() => navigate("/login")} className="w-full text-base">
              <LogIn strokeWidth={2.5} />
              로그인 / 회원가입
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
