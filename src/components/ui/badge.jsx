import { cn } from "@/lib/utils";
const tones = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
};
export function Badge({ tone = "slate", children, className }) {
    return (<span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>);
}
export const statusTone = (s) => s === "Completed" ? "green" : s === "In Progress" ? "amber" : "slate";
export const priorityTone = (p) => (p === "High" ? "rose" : p === "Medium" ? "sky" : "slate");
export function StatusBadge({ status }) {
    return <Badge tone={statusTone(status)}>{status}</Badge>;
}
export function PriorityBadge({ priority }) {
    return <Badge tone={priorityTone(priority)}>{priority}</Badge>;
}
