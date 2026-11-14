import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const base =
  "h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 sm:text-sm";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(base, className)} {...p} />
));
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(base, "appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%2394a3b8' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p} />
));
Select.displayName = "Select";

export function Label({ children, hint, className }: { children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn("mb-1.5 flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400", className)}>
      <span>{children}</span>
      {hint && <span className="font-normal normal-case tracking-normal text-slate-500">{hint}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-left text-sm text-slate-200"
    >
      <span>{label}</span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-emerald-500" : "bg-slate-700")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}
