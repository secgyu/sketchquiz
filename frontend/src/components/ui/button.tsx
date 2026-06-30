import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "press inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-[3px] border-ink font-extrabold whitespace-nowrap outline-none select-none focus-visible:ring-4 focus-visible:ring-ink/30 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-white text-ink",
        yellow: "bg-brand-yellow text-ink",
        pink: "bg-brand-pink text-ink",
        blue: "bg-brand-blue text-ink",
        green: "bg-brand-green text-ink",
        purple: "bg-brand-purple text-ink",
        dark: "bg-ink text-white",
        danger: "bg-brand-red text-ink",
      },
      size: {
        default: "h-11 px-4 text-sm",
        sm: "h-9 gap-1.5 px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-13 px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
