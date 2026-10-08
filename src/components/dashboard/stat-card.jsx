import { Card } from "@/components/ui/card";
export function StatCard({ label, value, icon, hint }) {
    return (<Card className="p-4 sm:p-5">
      <div className="flex min-h-[2.5rem] items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span>
      </div>
      <p className="tabular mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>);
}
