"use client";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { revalidateData } from "@/hooks/use-api";
import { api } from "@/lib/api/client";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { cn, formatDate, isOverdue } from "@/lib/utils";
export function TaskItem({ task, showProject = true, onEdit, onDelete }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const done = task.status === "Completed";
    const overdue = isOverdue(task.dueDate, task.status);
    async function patch(body, successTitle) {
        setBusy(true);
        try {
            await api.tasks.update(task.id, body);
            await revalidateData();
            toast({ title: successTitle, description: task.name });
        }
        catch (e) {
            toast({ variant: "error", title: "Could not update task", description: e.message });
        }
        finally {
            setBusy(false);
        }
    }
    return (<li className={cn("rounded-lg border bg-card p-4 shadow-card", busy && "opacity-70")}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={done} disabled={busy} onChange={() => patch({ status: done ? "Pending" : "Completed" }, done ? "Task reopened" : "Task completed")} aria-label={done ? `Mark “${task.name}” as not completed` : `Mark “${task.name}” as completed`} className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]"/>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className={cn("break-words font-medium", done && "text-muted-foreground line-through")}>{task.name}</p>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${task.name}`}>
                <Pencil className="h-4 w-4"/>
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Delete ${task.name}`}>
                <Trash2 className="h-4 w-4 text-destructive"/>
              </Button>
            </div>
          </div>
          {task.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {showProject && task.project && (<Link href={`/projects/${task.project.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                {task.project.name}
              </Link>)}
            <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive")}>
              <CalendarDays className="h-3.5 w-3.5"/>
              {task.dueDate ? `${overdue ? "Overdue · " : "Due "}${formatDate(task.dueDate)}` : "No due date"}
            </span>
            <label className="inline-flex items-center gap-1.5">
              <span className="sr-only sm:not-sr-only">Status</span>
              <Select aria-label={`Status of ${task.name}`} value={task.status} disabled={busy} className="h-8 w-auto py-0 text-xs" onChange={(e) => patch({ status: e.target.value }, "Status updated")}>
                {TASK_STATUSES.map((s) => (<option key={s}>{s}</option>))}
              </Select>
            </label>
            <label className="inline-flex items-center gap-1.5">
              <span className="sr-only sm:not-sr-only">Priority</span>
              <Select aria-label={`Priority of ${task.name}`} value={task.priority} disabled={busy} className="h-8 w-auto py-0 text-xs" onChange={(e) => patch({ priority: e.target.value }, "Priority updated")}>
                {TASK_PRIORITIES.map((p) => (<option key={p}>{p}</option>))}
              </Select>
            </label>
          </div>
        </div>
      </div>
    </li>);
}
