import { avatarColor } from "@/lib/mock";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-9 text-sm rounded-lg border-2 shadow-[2px_2px_0_0_var(--color-ink)]",
  md: "size-11 text-base rounded-lg border-[3px] shadow-[3px_3px_0_0_var(--color-ink)]",
  lg: "size-16 text-2xl rounded-xl border-[3px] shadow-[4px_4px_0_0_var(--color-ink)]",
} as const;

interface AvatarProps {
  nickname: string;
  avatar?: string; // 이모지 아바타 (없으면 닉네임 첫 글자로 대체)
  size?: keyof typeof SIZES;
  className?: string;
}

/** 이모지(있으면) 또는 닉네임 첫 글자를 원색 사각 배지로 보여주는 아바타 */
export function Avatar({ nickname, avatar, size = "md", className }: AvatarProps) {
  const content = avatar || ([...nickname][0]?.toUpperCase() ?? "?");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center border-ink font-extrabold text-ink",
        avatarColor(nickname),
        SIZES[size],
        className
      )}
    >
      {content}
    </span>
  );
}
