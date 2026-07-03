import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { AVATARS } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface AvatarPickerProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  nickname: string;
  value: string; // 현재 선택된 이모지 ("" = 기본: 닉네임 첫 글자)
  onSelect: (emoji: string) => void;
}

/** 이모지 아바타를 고르는 모달. 다음 방 입장부터 다른 사람에게도 이 아바타가 보인다. */
export function AvatarPicker({ open, onOpenChange, nickname, value, onSelect }: AvatarPickerProps) {
  const choose = (emoji: string) => {
    onSelect(emoji);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-in fade-in fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm duration-200" />
        <Dialog.Content className="animate-in fade-in zoom-in-95 fixed top-1/2 left-1/2 z-50 max-h-[90svh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-[3px] border-ink bg-white p-6 shadow-hard-lg duration-200 focus:outline-none">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-2xl font-black tracking-tight text-ink">아바타 고르기</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="닫기"
                className="press flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-white text-ink"
              >
                <X className="size-5" strokeWidth={2.5} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-sm font-bold text-muted-foreground">
            같은 방 친구들에게 보이는 내 얼굴이에요.
          </Dialog.Description>

          <div className="mt-4 flex justify-center">
            <Avatar nickname={nickname} avatar={value} size="lg" />
          </div>

          <div className="mt-5 grid grid-cols-6 gap-2">
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`아바타 ${emoji}`}
                aria-pressed={value === emoji}
                onClick={() => choose(emoji)}
                className={cn(
                  "press flex aspect-square items-center justify-center rounded-lg border-2 border-ink bg-white text-2xl",
                  value === emoji && "bg-brand-yellow",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>

          <Button variant="default" size="lg" className="mt-5 w-full" onClick={() => choose("")}>
            기본 아바타(닉네임 첫 글자)
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
