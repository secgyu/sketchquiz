import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function ChatPanel() {
  const messages = useGameStore((s) => s.messages);
  const sendMessage = useGameStore((s) => s.sendMessage);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    sendMessage(draft);
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
          placeholder="정답 입력!"
          autoComplete="off"
        />
        <Button type="submit" size="icon" variant="green" aria-label="전송">
          <Send strokeWidth={2.5} />
        </Button>
      </form>
    </div>
  );
}
