import { useEffect, useRef, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";

import { getSocket } from "@/lib/socket";
import { toast } from "@/store/toastStore";

/**
 * 소켓 연결이 끊기면 상단에 배너를 띄운다(재접속은 socket.io가 자동 시도).
 * 끊겼다가 다시 붙으면 성공 토스트로 알린다.
 */
export function ConnectionBanner() {
  const socket = getSocket();
  const [connected, setConnected] = useState(socket.connected);
  const droppedRef = useRef(false); // 한 번이라도 끊긴 뒤 복구됐는지 판별

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      if (droppedRef.current) {
        droppedRef.current = false;
        toast.success("다시 연결됐어요!");
      }
    };
    const onDisconnect = () => {
      droppedRef.current = true;
      setConnected(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  if (connected) return null;

  return (
    <div
      role="alert"
      className="animate-in fade-in slide-in-from-top-2 fixed inset-x-0 top-0 z-90 flex items-center justify-center gap-2 border-b-[3px] border-ink bg-brand-orange px-4 py-2 text-sm font-black text-ink duration-200"
    >
      {droppedRef.current ? (
        <>
          <WifiOff className="size-4" strokeWidth={2.5} />
          연결이 끊겼어요 · 다시 연결하는 중…
        </>
      ) : (
        <>
          <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
          서버에 연결하는 중…
        </>
      )}
    </div>
  );
}
