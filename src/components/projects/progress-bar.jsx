import { percent } from "@/lib/utils";
export function ProgressBar({ done, total }) {
    const pct = percent(done, total);
    return (<div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{total === 0 ? "No tasks yet" : `${done} of ${total} tasks done`}</span>
        <span className="tabular">{pct}%</span>
      </div>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Task completion" className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }}/>
      </div>
    </div>);
}
