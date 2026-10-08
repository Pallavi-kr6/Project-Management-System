"use client";
import { ArrowLeft, CalendarRange, FolderX, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressBar } from "@/components/projects/progress-bar";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { TasksPanel } from "@/components/tasks/tasks-panel";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { revalidateData, useProject } from "@/hooks/use-api";
import { api } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/utils";
export default function ProjectDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const toast = useToast();
    const { data: project, error, isLoading, mutate } = useProject(id);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    async function confirmDelete() {
        try {
            await api.projects.remove(id);
            await revalidateData();
            toast({ title: "Project deleted" });
            router.push("/projects");
        }
        catch (e) {
            toast({ variant: "error", title: "Could not delete project", description: e.message });
        }
    }
    const back = (<Link href="/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4"/> All projects
    </Link>);
    if (isLoading && !project) {
        return (<>
        {back}
        <Skeleton className="mb-6 h-44"/>
        <Skeleton className="h-64"/>
      </>);
    }
    const errorCode = error?.code;
    if (errorCode === "PROJECT_NOT_FOUND" || errorCode === "INVALID_ID") {
        return (<>
        {back}
        <EmptyState icon={<FolderX className="h-5 w-5"/>} title="Project not found" description="It may have been deleted, or you may not have access to it." action={<Link href="/projects" className="text-sm font-medium text-primary hover:underline">Back to projects</Link>}/>
      </>);
    }
    if (error && !project) {
        return (<>
        {back}
        <ErrorState error={error} onRetry={() => mutate()}/>
      </>);
    }
    if (!project)
        return null;
    return (<>
      {back}
      <PageHeader title={project.name} actions={<>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4"/> Edit
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 text-destructive"/> Delete
            </Button>
          </>}/>

      <Card className="mb-8 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <StatusBadge status={project.status}/>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarRange className="h-4 w-4"/>
            {formatDate(project.startDate)} → {formatDate(project.endDate)}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{project.description || <span className="text-muted-foreground">No description provided.</span>}</p>
        <dl className="mt-5 grid gap-4 border-t pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Start date</dt>
            <dd className="font-medium">{formatDate(project.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">End date</dt>
            <dd className="font-medium">{formatDate(project.endDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Created</dt>
            <dd className="font-medium">{formatDateTime(project.createdAt)}</dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="mb-1 text-xs text-muted-foreground">Progress</dt>
            <dd>
              <ProgressBar done={project.completedTasks} total={project.totalTasks}/>
            </dd>
          </div>
        </dl>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Tasks</h2>
      <TasksPanel projectId={project.id}/>

      <ProjectFormDialog open={editOpen} onClose={() => setEditOpen(false)} project={project}/>
      <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={confirmDelete} title="Delete this project?" description={`“${project.name}” and all ${project.totalTasks} of its tasks will be permanently deleted. This cannot be undone.`} confirmLabel="Delete project"/>
    </>);
}
