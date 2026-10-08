import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
const base = "w-full rounded-md border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60";
const state = (invalid) => (invalid ? "border-destructive" : "border-input");
export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn(base, "h-10", state(invalid), className)} {...props}/>;
});
export const Textarea = forwardRef(function Textarea({ className, invalid, ...props }, ref) {
    return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(base, "min-h-[88px] py-2", state(invalid), className)} {...props}/>;
});
export const Select = forwardRef(function Select({ className, invalid, children, ...props }, ref) {
    return (<select ref={ref} aria-invalid={invalid || undefined} className={cn(base, "h-10 pr-8", state(invalid), className)} {...props}>
        {children}
      </select>);
});
/** Label + control + error text, wired together with ids for screen readers. */
export function Field({ label, error, hint, children, className, }) {
    const id = useId();
    const messageId = `${id}-msg`;
    return (<div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children({ id, invalid: Boolean(error), "aria-describedby": error || hint ? messageId : undefined })}
      {error ? (<p id={messageId} role="alert" className="text-xs text-destructive">
          {error}
        </p>) : hint ? (<p id={messageId} className="text-xs text-muted-foreground">
          {hint}
        </p>) : null}
    </div>);
}
