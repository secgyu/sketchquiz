import { Dialog } from "radix-ui";
import { MessageCircle, Pencil, Trophy, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Users,
    color: "bg-brand-blue",
    title: "방에 모이기",
    desc: "방을 만들거나 코드로 입장해 친구들과 같은 방에 모여요.",
  },
  {
    icon: Pencil,
    color: "bg-brand-yellow",
    title: "그리기",
    desc: "내 차례엔 제시어 3개 중 하나를 골라 그림으로 표현해요.",
  },
  {
    icon: MessageCircle,
    color: "bg-brand-green",
    title: "맞히기",
    desc: "다른 사람은 채팅으로 정답을 입력해요. 빨리 맞힐수록 점수가 높아요!",
  },
  {
    icon: Trophy,
    color: "bg-brand-pink",
    title: "순위",
    desc: "모든 라운드가 끝나면 최종 순위를 확인해요.",
  },
];

/** 처음 온 사람에게 게임 규칙을 보여주는 온보딩 모달 (접근성: radix Dialog — 포커스 트랩·ESC 내장). */
export function HowToPlay({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-in fade-in fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm duration-200" />
        <Dialog.Content className="animate-in fade-in zoom-in-95 fixed top-1/2 left-1/2 z-50 max-h-[90svh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-[3px] border-ink bg-white p-6 shadow-hard-lg duration-200 focus:outline-none">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-2xl font-black tracking-tight text-ink">게임 방법</Dialog.Title>
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
            그리고 맞히는 실시간 스케치 퀴즈예요.
          </Dialog.Description>

          <ol className="mt-5 space-y-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-ink shadow-[2px_2px_0_0_var(--color-ink)]",
                    step.color,
                  )}
                >
                  <step.icon className="size-5 text-ink" strokeWidth={2.5} />
                </span>
                <div>
                  <p className="text-sm font-black text-ink">
                    {index + 1}. {step.title}
                  </p>
                  <p className="text-sm font-medium text-ink/75">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <Dialog.Close asChild>
            <Button variant="green" size="lg" className="mt-6 w-full text-base">
              알겠어요!
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
