"use client";
import { CheckCircle2, Clock3, FolderKanban, ListChecks, Loader, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DistributionCard } from "@/components/dashboard/distribution-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton, StaleBanner } from "@/components/ui/states";
import { useCurrentUser, useDashboard } from "@/hooks/use-api";
import { cn, formatDate, isOverdue } from "@/lib/utils";
export default function DashboardPage() {
    const { data, error, isLoading, mutate } = useDashboard();
    const { data: user } = useCurrentUser();
    const [createOpen, setCreateOpen] = useState(false);
    const firstName = user?.fullName?.split(" ")[0];
    return (<>
      <PageHeader title={firstName ? `Welcome back, ${firstName}` : "Dashboard"} description="A live summary of your projects and tasks." actions={<Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4"/> New project
          </Button>}/>

      {error && data && <StaleBanner error={error} onRetry={() => mutate()}/>}
      {error && !data ? (<ErrorState error={error} onRetry={() => mutate()}/>) : isLoading || !data ? (<div aria-busy="true" aria-label="Loading dashboard" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-28"/>))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-52"/>
            <Skeleton className="h-52"/>
          </div>
        </div>) : (<div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Total projects" value={data.stats.totalProjects} icon={<FolderKanban className="h-4 w-4"/>}/>
            <StatCard label="Total tasks" value={data.stats.totalTasks} icon={<ListChecks className="h-4 w-4"/>}/>
            <StatCard label="Completed tasks" value={data.stats.completedTasks} icon={<CheckCircle2 className="h-4 w-4"/>}/>
            <StatCard label="Pending tasks" value={data.stats.pendingTasks} icon={<Clock3 className="h-4 w-4"/>} hint={`${data.stats.inProgressTasks} more in progress`}/>
            <StatCard label="Projects in progress" value={data.stats.projectsInProgress} icon={<Loader className="h-4 w-4"/>}/>
          </div>

          {data.stats.totalProjects === 0 ? (<EmptyState icon={<FolderKanban className="h-5 w-5"/>} title="Your workspace is empty" description="Create your first project, then add tasks to see your progress here." action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4"/> Create project</Button>}/>) : (<>
              <div className="grid gap-4 lg:grid-cols-2">
                <DistributionCard title="Task status" description="All tasks across your projects" counts={data.taskStatusDistribution}/>
                <DistributionCard title="Project status" description="Where each project stands" counts={data.projectStatusDistribution}/>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Upcoming deadlines" description="Open tasks, soonest due date first" action={<Link href="/tasks" className="text-sm font-medium text-primary hover:underline">All tasks</Link>}/>
                  {data.upcomingTasks.length === 0 ? (<p className="px-5 py-8 text-center text-sm text-muted-foreground">No open tasks have a due date.</p>) : (<ul className="divide-y">
                      {data.upcomingTasks.map((t) => {
                        const overdue = isOverdue(t.dueDate, t.status);
                        return (<li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{t.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {t.project ? <Link href={`/projects/${t.project.id}`} className="hover:underline">{t.project.name}</Link> : null}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                                {overdue ? "Overdue · " : ""}
                                {formatDate(t.dueDate)}
                              </span>
                              <PriorityBadge priority={t.priority}/>
                            </div>
                          </li>);
                    })}
                    </ul>)}
                </Card>

                <Card>
                  <CardHeader title="Recent projects" description="Most recently created" action={<Link href="/projects" className="text-sm font-medium text-primary hover:underline">All projects</Link>}/>
                  <ul className="divide-y">
                    {data.recentProjects.map((p) => (<li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <Link href={`/projects/${p.id}`} className="block truncate text-sm font-medium hover:text-primary hover:underline">
                            {p.name}
                          </Link>
                          <p className="text-xs text-muted-foreground tabular">
                            {p.completedTasks}/{p.totalTasks} tasks done
                          </p>
                        </div>
                        <StatusBadge status={p.status}/>
                      </li>))}
                  </ul>
                </Card>
              </div>
            </>)}
        </div>)}

      <ProjectFormDialog open={createOpen} onClose={() => setCreateOpen(false)}/>
    </>);
}
