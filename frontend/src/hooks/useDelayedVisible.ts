import { useEffect, useRef, useState } from "react";

/**
 * 로딩 표시의 깜빡임을 막는 실무 패턴(지연 표시 + 최소 유지).
 * - delay: 이 시간 안에 작업이 끝나면 아예 표시하지 않는다(빠른 작업은 즉시처럼 느껴짐).
 * - minDuration: 일단 표시되면 최소 이 시간은 유지한다(번쩍임 방지).
 *
 * @param active 실제 로딩 여부
 * @returns 화면에 로딩 표시를 그릴지 여부
 */
export function useDelayedVisible(active: boolean, delay = 300, minDuration = 500): boolean {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const shownAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const set = (v: boolean) => {
    visibleRef.current = v;
    setVisible(v);
  };

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (active) {
      // delay가 지나도 여전히 로딩 중이면 그때 표시한다.
      timerRef.current = setTimeout(() => {
        shownAtRef.current = Date.now();
        set(true);
      }, delay);
    } else if (visibleRef.current) {
      // 이미 보이는 중이면 최소 유지 시간을 채운 뒤 숨긴다.
      const remaining = Math.max(0, minDuration - (Date.now() - shownAtRef.current));
      timerRef.current = setTimeout(() => set(false), remaining);
    }
    return () => clearTimeout(timerRef.current);
  }, [active, delay, minDuration]);

  return visible;
}
