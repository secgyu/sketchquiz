import { useEffect } from "react";
import { Outlet, useNavigate, useParams } from "react-router";

import { ConnectionBanner } from "@/components/ConnectionBanner";
import { useSocket } from "@/hooks/useSocket";
import { useGameStore } from "@/store/gameStore";
import { useRoomStore } from "@/store/roomStore";
import { toast } from "@/store/toastStore";

/**
 * /room/:code 하위(대기실·게임·결과)를 감싸는 레이아웃.
 * 화면을 옮겨도 언마운트되지 않으므로, 방·게임 소켓 리스너를 여기 한 곳에 모은다.
 * 덕분에 화면 전환 순간에도 이벤트를 놓치지 않는다(첫 game:turn 포함).
 */
export function RoomLayout() {
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const { socket } = useSocket();

  useEffect(() => {
    const room = useRoomStore.getState();
    const game = useGameStore.getState();

    const onRoomState = room.setRoom;
    const onRoomError = ({ message }: { message: string }) => {
      room.setError(message);
      toast.error(message); // 게임 중처럼 인라인 에러가 안 보이는 화면에서도 알려준다.
    };
    const onTurn = (p: Parameters<typeof game.onTurn>[0]) => {
      useGameStore.getState().onTurn(p);
      navigate(`/room/${code}/play`);
    };
    const onWordChoices = ({ choices }: { choices: string[] }) => useGameStore.getState().onWordChoices(choices);
    const onSync = (p: Parameters<typeof game.onSync>[0]) => {
      useGameStore.getState().onSync(p);
      navigate(`/room/${code}/play`);
    };
    const onTurnStart = (p: Parameters<typeof game.onTurnStart>[0]) => useGameStore.getState().onTurnStart(p);
    const onTurnEnd = (p: Parameters<typeof game.onTurnEnd>[0]) => useGameStore.getState().onTurnEnd(p);
    const onChat = (p: Parameters<typeof game.onChat>[0]) => useGameStore.getState().onChat(p);
    const onCorrect = (p: Parameters<typeof game.onCorrect>[0]) => {
      const g = useGameStore.getState();
      g.onCorrect(p);
      if (p.playerId === socket.id) g.flashCorrect(); // 맞힌 본인에게만 "정답!" 오버레이
    };
    const onPlayerLeft = ({ nickname }: { nickname: string }) => useGameStore.getState().onPlayerLeft(nickname);
    const onEnded = ({ ranking }: { ranking: Parameters<typeof game.onEnded>[0] }) => {
      useGameStore.getState().onEnded(ranking);
      navigate(`/room/${code}/result`);
    };

    socket.on("room:state", onRoomState);
    socket.on("room:error", onRoomError);
    socket.on("game:turn", onTurn);
    socket.on("game:sync", onSync);
    socket.on("game:word-choices", onWordChoices);
    socket.on("game:turn-start", onTurnStart);
    socket.on("game:turn-end", onTurnEnd);
    socket.on("chat:message", onChat);
    socket.on("chat:correct", onCorrect);
    socket.on("player:left", onPlayerLeft);
    socket.on("game:ended", onEnded);

    // (재)연결될 때마다 이 방에 입장을 요청한다. 서버가 재접속이면 상태를 복원(room:state+game:sync),
    // 신규면 새로 입장시킨다. 새로고침·일시적 연결 끊김 모두 이 한 경로로 처리된다.
    const rejoin = () => socket.emit("room:join", { code });
    socket.on("connect", rejoin);
    if (socket.connected) rejoin(); // 이미 연결된 채 화면만 이동한 경우

    return () => {
      socket.off("connect", rejoin);
      socket.off("room:state", onRoomState);
      socket.off("room:error", onRoomError);
      socket.off("game:turn", onTurn);
      socket.off("game:sync", onSync);
      socket.off("game:word-choices", onWordChoices);
      socket.off("game:turn-start", onTurnStart);
      socket.off("game:turn-end", onTurnEnd);
      socket.off("chat:message", onChat);
      socket.off("chat:correct", onCorrect);
      socket.off("player:left", onPlayerLeft);
      socket.off("game:ended", onEnded);
    };
  }, [socket, code, navigate]);

  return (
    <>
      <ConnectionBanner />
      <Outlet />
    </>
  );
}
