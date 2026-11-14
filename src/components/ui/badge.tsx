import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums", {
  variants: {
    variant: {
      default: "bg-slate-800 text-slate-200 border border-slate-700",
      success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
      warning: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      danger: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}
