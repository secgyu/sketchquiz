import { Loader2 } from "lucide-react";

/** 화면 정중앙에 스피너와 문구를 띄우는 전체 오버레이. */
export function LoadingOverlay({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="animate-in fade-in fixed inset-0 z-90 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm duration-150"
    >
      <div className="animate-in zoom-in-95 flex flex-col items-center gap-4 rounded-2xl border-[3px] border-ink bg-white px-10 py-8 shadow-hard-lg duration-150">
        <Loader2 className="size-10 animate-spin text-ink" strokeWidth={2.5} />
        <span className="text-lg font-black text-ink">{message}</span>
      </div>
    </div>
  );
}
