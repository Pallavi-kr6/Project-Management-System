import { AlertTriangle, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
export function Skeleton({ className }) {
    return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)}/>;
}
export function EmptyState({ icon, title, description, action }) {
    return (<div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>);
}
export function ErrorState({ error, onRetry }) {
    const code = error?.code;
    const message = error?.message ?? "Something went wrong.";
    const offline = code === "NETWORK_ERROR";
    return (<div role="alert" className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        {offline ? <WifiOff className="h-5 w-5"/> : <AlertTriangle className="h-5 w-5"/>}
      </div>
      <h3 className="text-sm font-semibold">{offline ? "You appear to be offline" : "We couldn't load this"}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (<Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>)}
    </div>);
}
/** Shown above already-loaded content when a background refresh fails (offline, server down). */
export function StaleBanner({ error, onRetry }) {
    const message = error?.message ?? "Something went wrong.";
    return (<div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <span>{message} Showing the last data that loaded.</span>
      {onRetry && (<Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>)}
    </div>);
}
