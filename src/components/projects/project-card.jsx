import { CalendarRange, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { ProgressBar } from "./progress-bar";
export function ProjectCard({ project, onEdit, onDelete }) {
    return (<Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/projects/${project.id}`} className="min-w-0 rounded-sm text-base font-semibold hover:text-primary hover:underline">
          <span className="line-clamp-2 break-words">{project.name}</span>
        </Link>
        <StatusBadge status={project.status}/>
      </div>
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{project.description || "No description"}</p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarRange className="h-3.5 w-3.5"/>
        {formatDate(project.startDate)} → {formatDate(project.endDate)}
      </p>
      <div className="mt-4">
        <ProgressBar done={project.completedTasks} total={project.totalTasks}/>
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <Link href={`/projects/${project.id}`} className="text-sm font-medium text-primary hover:underline">
          Open project
        </Link>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${project.name}`}>
            <Pencil className="h-4 w-4"/>
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Delete ${project.name}`}>
            <Trash2 className="h-4 w-4 text-destructive"/>
          </Button>
        </div>
      </div>
    </Card>);
}
