import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-black/20", className)} {...p} />;
}
export function CardHeader({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4 pb-2 sm:p-5 sm:pb-3", className)} {...p} />;
}
export function CardTitle({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-bold tracking-tight text-slate-50 sm:text-lg", className)} {...p} />;
}
export function CardDescription({ className, ...p }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-400", className)} {...p} />;
}
export function CardContent({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-2 sm:p-5 sm:pt-2", className)} {...p} />;
}
