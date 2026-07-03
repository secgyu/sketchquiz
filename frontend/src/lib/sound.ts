// 간단한 효과음. mp3 자산 없이 Web Audio API로 합성한다(용량·라이선스 부담 없음).
// ponytail: 짧은 오실레이터 비프 수준. 풍부한 사운드가 필요하면 이후 오디오 파일로 교체.

let ctx: AudioContext | null = null;
const MUTE_KEY = "sq_muted";

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

interface Note {
  freq: number;
  start: number; // 시작 오프셋(초)
  dur: number; // 지속(초)
}

/** 음 시퀀스를 짧게 연주한다(각 음은 페이드아웃). */
function playNotes(notes: Note[], type: OscillatorType = "triangle", peak = 0.18) {
  if (isMuted()) return;
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume(); // 첫 상호작용 후 깨우기
  const now = audio.currentTime;
  for (const n of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = n.freq;
    gain.gain.setValueAtTime(0.0001, now + n.start);
    gain.gain.linearRampToValueAtTime(peak, now + n.start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + n.start);
    osc.stop(now + n.start + n.dur + 0.02);
  }
}

export function isMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean): void {
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

export const sound = {
  /** 정답 — 밝게 올라가는 두 음 */
  correct() {
    playNotes([
      { freq: 660, start: 0, dur: 0.12 },
      { freq: 988, start: 0.1, dur: 0.18 },
    ]);
  },
  /** 게임 종료 — 상승 팡파르 */
  gameEnd() {
    playNotes([
      { freq: 523, start: 0, dur: 0.14 },
      { freq: 659, start: 0.13, dur: 0.14 },
      { freq: 784, start: 0.26, dur: 0.14 },
      { freq: 1047, start: 0.39, dur: 0.3 },
    ]);
  },
};
