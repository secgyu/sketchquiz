import { useEffect, useRef, useState } from "react";
import { Check, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/hooks/useSocket";
import { avatarColor, type ChatMessage } from "@/lib/mock";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";

function MessageRow({ message, me }: { message: ChatMessage; me?: string }) {
  // 시스템: 대화 흐름과 구분되는 중앙 앰비언트 알약
  if (message.kind === "system") {
    return (
      <li className="flex justify-center py-1">
        <span className="rounded-full border border-ink/15 bg-ink/5 px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
          {message.text}
        </span>
      </li>
    );
  }
  // 정답: 초록 배지 + 체크 아이콘으로 강조
  if (message.kind === "correct") {
    return (
      <li className="flex items-center gap-1.5 rounded-lg border-2 border-ink bg-brand-green px-2.5 py-1.5 text-sm font-extrabold text-ink">
        <Check className="size-4 shrink-0" strokeWidth={3} aria-hidden="true" />
        <span>{message.text}</span>
      </li>
    );
  }
  // 일반: 발화자 색 점으로 화자 구분 + 내 메시지는 옅게 강조
  const mine = !!me && message.nickname === me;
  return (
    <li className={cn("flex items-start gap-1.5 rounded-lg px-1.5 py-0.5 text-sm", mine && "bg-brand-blue/15")}>
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full border border-ink", avatarColor(message.nickname ?? ""))} aria-hidden="true" />
      <span className="min-w-0">
        <span className="font-extrabold text-ink">{message.nickname}</span>
        <span className="ml-1.5 font-medium text-ink/80">{message.text}</span>
      </span>
    </li>
  );
}

export function ChatPanel({ canGuess = true }: { canGuess?: boolean }) {
  const { socket } = useSocket();
  const messages = useGameStore((s) => s.messages);
  const me = useAuthStore((s) => s.user?.username);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 서버가 모든 참가자(보낸 사람 포함)에게 되돌려주므로 로컬에 직접 추가하지 않는다.
  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    socket.emit("chat:message", { text });
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-2 inline-block self-start -rotate-1 border-2 border-ink bg-brand-purple px-2 py-0.5 text-xs font-black uppercase text-ink">
        채팅 · 추측
      </h2>
      <ul className="thin-scroll flex-1 space-y-1.5 overflow-y-auto pr-1">
        {messages.map((message) => (
          <MessageRow key={message.id} message={message} me={me} />
        ))}
        <div ref={endRef} />
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={canGuess ? "정답 입력!" : "출제자는 채팅할 수 없어요"}
          autoComplete="off"
          disabled={!canGuess}
        />
        <Button type="submit" size="icon" variant="green" aria-label="전송" disabled={!canGuess}>
          <Send strokeWidth={2.5} />
        </Button>
      </form>
    </div>
  );
}
