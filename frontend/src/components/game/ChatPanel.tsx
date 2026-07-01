import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/hooks/useSocket";
import type { ChatMessage } from "@/lib/mock";
import { useGameStore } from "@/store/gameStore";

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.kind === "system") {
    return (
      <li className="py-0.5 text-center text-xs font-bold text-muted-foreground">
        {message.text}
      </li>
    );
  }
  if (message.kind === "correct") {
    return (
      <li className="rounded-lg border-2 border-ink bg-brand-green px-2.5 py-1.5 text-sm font-extrabold text-ink">
        {message.text}
      </li>
    );
  }
  return (
    <li className="px-1 py-0.5 text-sm">
      <span className="font-extrabold text-ink">{message.nickname}</span>
      <span className="ml-1.5 font-medium text-ink/80">{message.text}</span>
    </li>
  );
}

export function ChatPanel({ canGuess = true }: { canGuess?: boolean }) {
  const { socket } = useSocket();
  const messages = useGameStore((s) => s.messages);
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
          <MessageRow key={message.id} message={message} />
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
