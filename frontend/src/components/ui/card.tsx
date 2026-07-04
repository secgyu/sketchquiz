import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cn } from "@/lib/utils";

/**
 * 네오브루탈리즘 기본 카드 표면 (굵은 테두리 + 하드 섀도 + 흰 배경).
 * 크기·여백·정렬 등은 className으로 넘긴다. 기본 태그는 div, 화면 최상위엔 as="main".
 */
export function Card({ as, className, ...props }: { as?: "div" | "main" } & ComponentPropsWithoutRef<"div">) {
  const Tag: ElementType = as ?? "div";
  return <Tag className={cn("rounded-2xl border-[3px] border-ink bg-white shadow-hard-lg", className)} {...props} />;
}
