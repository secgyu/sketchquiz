import { CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToastStore, type ToastKind } from "@/store/toastStore";

const KIND_STYLE: Record<ToastKind, { bg: string; Icon: typeof Info }> = {
  success: { bg: "bg-brand-green", Icon: CheckCircle2 },
  error: { bg: "bg-brand-red", Icon: XCircle },
  info: { bg: "bg-brand-blue", Icon: Info },
};

/** 화면 상단 중앙에 토스트를 쌓아 보여준다. 루트에 한 번만 마운트한다. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-100 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const { bg, Icon } = KIND_STYLE[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "animate-in fade-in slide-in-from-top-2 pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border-[3px] border-ink px-4 py-3 text-ink shadow-hard duration-200",
              bg,
            )}
          >
            <Icon className="size-5 shrink-0" strokeWidth={2.5} />
            <span className="flex-1 text-sm font-black">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="닫기"
              className="press flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-white/60 text-ink"
            >
              <X className="size-3.5" strokeWidth={3} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
