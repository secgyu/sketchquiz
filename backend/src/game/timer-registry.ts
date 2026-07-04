/**
 * 키별 단발 타이머 모음. 같은 키로 다시 예약하면 기존 예약을 취소하고 새로 건다.
 * 턴 제한시간·재접속 유예처럼 "키 하나당 최대 하나의 예약"을 다루는 곳에서 공유한다.
 */
export class TimerRegistry {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  /** key의 기존 예약을 취소하고 ms 뒤 fn을 실행하도록 새로 예약한다(실행되면 스스로 목록에서 빠진다). */
  set(key: string, ms: number, fn: () => void): void {
    this.clear(key);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        fn();
      }, ms),
    );
  }

  /** key에 걸린 예약이 있으면 취소한다. */
  clear(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}
