import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-muted text-foreground hover:bg-muted/70",
    outline: "border border-input bg-card text-foreground hover:bg-muted",
    ghost: "text-foreground hover:bg-muted",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};
const sizes = {
    sm: "h-8 px-3 text-sm gap-1.5",
    md: "h-10 px-4 text-sm gap-2",
    icon: "h-9 w-9",
};
export const Button = forwardRef(function Button({ variant = "primary", size = "md", loading = false, disabled, className, children, type = "button", ...props }, ref) {
    return (<button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cn("inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-60", variants[variant], sizes[size], className)} {...props}>
      {loading && <Spinner />}
      {children}
    </button>);
});
