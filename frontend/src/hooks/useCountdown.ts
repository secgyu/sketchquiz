import { useEffect, useState } from "react";

/** deadline(epoch ms)까지 남은 초를 0 이상으로 반환한다. 250ms마다 갱신. */
export function useCountdown(deadline: number): number {
  const [left, setLeft] = useState(() => secondsLeft(deadline));
  useEffect(() => {
    const tick = () => setLeft(secondsLeft(deadline));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);
  return left;
}

function secondsLeft(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}
