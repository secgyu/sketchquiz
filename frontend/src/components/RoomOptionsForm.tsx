import { type ComponentType } from "react";
import { Clock, Globe, Hash, Lock, Users } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const ROUND_OPTIONS = [3, 5, 7];
export const TIME_OPTIONS = [60, 80, 100];
export const PLAYER_OPTIONS = [4, 6, 8];

/** 방 설정 값. 생성 화면과 대기실 편집이 공유한다. */
export interface RoomOptionsValue {
  name: string;
  isPublic: boolean;
  rounds: number;
  seconds: number;
  maxPlayers: number;
}

/** 프리셋 값 중 하나를 고르는 옵션 행. isDisabled로 특정 프리셋을 잠글 수 있다. */
function OptionRow({
  icon: Icon,
  label,
  options,
  value,
  unit,
  onChange,
  isDisabled,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  options: number[];
  value: number;
  unit: string;
  onChange: (v: number) => void;
  isDisabled?: (option: number) => boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-black text-ink">
        <Icon className="size-4" strokeWidth={2.5} />
        {label}
      </div>
      <div className="flex gap-2">
        {options.map((o) => {
          const disabled = isDisabled?.(o) ?? false;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={value === o}
              disabled={disabled}
              onClick={() => onChange(o)}
              className={cn(
                "press flex-1 rounded-xl border-[3px] border-ink py-2.5 text-base font-black text-ink",
                value === o ? "bg-brand-yellow" : "bg-white",
                disabled && "cursor-not-allowed opacity-40",
              )}
            >
              {o}
              {unit}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 방 설정 입력 폼(제어 컴포넌트). value/onChange로 상위가 상태를 소유한다.
 * minPlayers: 현재 인원보다 적은 최대 인원 프리셋을 비활성화(대기실 편집용).
 */
export function RoomOptionsForm({
  value,
  onChange,
  namePlaceholder,
  minPlayers = 0,
}: {
  value: RoomOptionsValue;
  onChange: (patch: Partial<RoomOptionsValue>) => void;
  namePlaceholder?: string;
  minPlayers?: number;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="roomName" className="text-sm font-black text-ink">
          방 이름
        </label>
        <Input
          id="roomName"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={20}
          placeholder={namePlaceholder}
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <div className="text-sm font-black text-ink">공개 설정</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={value.isPublic}
            onClick={() => onChange({ isPublic: true })}
            className={cn(
              "press flex flex-col items-center gap-1 rounded-xl border-[3px] border-ink px-3 py-3 text-ink",
              value.isPublic ? "bg-brand-green" : "bg-white",
            )}
          >
            <Globe strokeWidth={2.5} />
            <span className="text-sm font-black">공개방</span>
            <span className="text-[11px] font-bold text-ink/70">목록에서 누구나 입장</span>
          </button>
          <button
            type="button"
            aria-pressed={!value.isPublic}
            onClick={() => onChange({ isPublic: false })}
            className={cn(
              "press flex flex-col items-center gap-1 rounded-xl border-[3px] border-ink px-3 py-3 text-ink",
              !value.isPublic ? "bg-brand-blue" : "bg-white",
            )}
          >
            <Lock strokeWidth={2.5} />
            <span className="text-sm font-black">비공개방</span>
            <span className="text-[11px] font-bold text-ink/70">코드 아는 사람만</span>
          </button>
        </div>
        <p className="text-xs font-bold text-muted-foreground">
          {value.isPublic
            ? "공개방은 코드 없이 목록에서 바로 입장할 수 있어요."
            : "비공개방은 코드를 공유해야 입장할 수 있어요."}
        </p>
      </div>

      <OptionRow
        icon={Hash}
        label="라운드"
        options={ROUND_OPTIONS}
        value={value.rounds}
        unit="회"
        onChange={(rounds) => onChange({ rounds })}
      />
      <OptionRow
        icon={Clock}
        label="라운드당 시간"
        options={TIME_OPTIONS}
        value={value.seconds}
        unit="초"
        onChange={(seconds) => onChange({ seconds })}
      />
      <OptionRow
        icon={Users}
        label="최대 인원"
        options={PLAYER_OPTIONS}
        value={value.maxPlayers}
        unit="명"
        onChange={(maxPlayers) => onChange({ maxPlayers })}
        isDisabled={(o) => o < minPlayers}
      />
    </div>
  );
}
