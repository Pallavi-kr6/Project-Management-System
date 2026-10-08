import { cn } from "@/lib/utils";
export function Card({ className, ...props }) {
    return <div className={cn("rounded-lg border bg-card shadow-card", className)} {...props}/>;
}
export function CardHeader({ title, description, action }) {
    return (<div className="flex items-start justify-between gap-3 border-b px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>);
}
