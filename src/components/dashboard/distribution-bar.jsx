import { Card, CardHeader } from "@/components/ui/card";
import { cn, percent } from "@/lib/utils";
const COLORS = {
    Pending: "bg-slate-400 dark:bg-slate-500",
    "Not Started": "bg-slate-400 dark:bg-slate-500",
    "In Progress": "bg-amber-500",
    Completed: "bg-emerald-500",
};
/** A segmented bar + legend. Pure CSS: no chart library needed for three categories. */
export function DistributionCard({ title, description, counts }) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return (<Card>
      <CardHeader title={title} description={description}/>
      <div className="p-5">
        {total === 0 ? (<p className="py-4 text-center text-sm text-muted-foreground">Nothing to show yet.</p>) : (<>
            <div role="img" aria-label={Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", ")} className="flex h-3 overflow-hidden rounded-full bg-muted">
              {Object.entries(counts).map(([label, value]) => value > 0 ? <div key={label} className={cn("h-full", COLORS[label])} style={{ width: `${(value / total) * 100}%` }}/> : null)}
            </div>
            <ul className="mt-4 space-y-2">
              {Object.entries(counts).map(([label, value]) => (<li key={label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", COLORS[label])}/>
                    {label}
                  </span>
                  <span className="tabular text-muted-foreground">
                    {value} · {percent(value, total)}%
                  </span>
                </li>))}
            </ul>
          </>)}
      </div>
    </Card>);
}
