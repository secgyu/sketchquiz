import { useEffect, useState } from "react";

import { Confetti } from "@/components/game/Confetti";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * 본인이 정답을 맞힌 순간 잠깐 "정답!" + 폭죽을 띄운다.
 * trigger 값이 바뀔 때마다(0 제외) 1.5초간 표시하고 스스로 사라진다.
 */
export function CorrectFlash({ trigger }: { trigger: number }) {
  const reduced = usePrefersReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(id);
  }, [trigger]);

  if (!show) return null;
  return (
    <>
      {!reduced && <Confetti />}
      <div role="status" className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
        <span className="animate-in zoom-in-50 fade-in rotate-[-4deg] rounded-2xl border-4 border-ink bg-brand-green px-10 py-5 text-5xl font-black text-ink shadow-hard-lg duration-300">
          정답!
        </span>
      </div>
    </>
  );
}
