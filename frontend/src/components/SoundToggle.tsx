import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

import { isMuted, setMuted } from "@/lib/sound";
import { cn } from "@/lib/utils";

/** 효과음 음소거 토글. 상태는 localStorage에 저장되어 화면 이동/새로고침에도 유지된다. */
export function SoundToggle({ className }: { className?: string }) {
  const [muted, setMutedState] = useState(isMuted);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "소리 켜기" : "소리 끄기"}
      aria-pressed={muted}
      className={cn(
        "press flex size-9 items-center justify-center rounded-lg border-2 border-ink bg-white text-ink",
        className,
      )}
    >
      {muted ? <VolumeX className="size-5" strokeWidth={2.5} /> : <Volume2 className="size-5" strokeWidth={2.5} />}
    </button>
  );
}
