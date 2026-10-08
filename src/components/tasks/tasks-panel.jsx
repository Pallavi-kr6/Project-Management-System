"use client";
import { ListChecks, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select } from "@/components/ui/form-controls";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, Skeleton, StaleBanner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { revalidateData, useProjects, useTasks } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { api } from "@/lib/api/client";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskItem } from "./task-item";
/**
 * Search + filters + paginated list + create/edit/delete dialogs.
 * Used by the global Tasks page (all projects) and by a project's detail page
 * (pass `projectId` to scope it to that project).
 */
export function TasksPanel({ projectId }) {
    const toast = useToast();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [priority, setPriority] = useState("");
    const [projectFilter, setProjectFilter] = useState("");
    const [page, setPage] = useState(1);
    const debouncedSearch = useDebounce(search.trim());
    const effectiveProject = projectId ?? projectFilter;
    const { data, error, isLoading, mutate } = useTasks({
        search: debouncedSearch,
        status,
        priority,
        projectId: effectiveProject || undefined,
        page,
        pageSize: 10,
    });
    const { data: projectsData } = useProjects({ pageSize: 100 });
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState();
    const [deleting, setDeleting] = useState(null);
    const tasks = data?.data ?? [];
    const filtered = Boolean(debouncedSearch || status || priority || projectFilter);
    const resetPage = () => setPage(1);
    async function confirmDelete() {
        if (!deleting)
            return;
        try {
            await api.tasks.remove(deleting.id);
            await revalidateData();
            toast({ title: "Task deleted", description: deleting.name });
            setDeleting(null);
        }
        catch (e) {
            toast({ variant: "error", title: "Could not delete task", description: e.message });
        }
    }
    function clearFilters() {
        setSearch("");
        setStatus("");
        setPriority("");
        setProjectFilter("");
        setPage(1);
    }
    return (<section aria-label="Tasks">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input type="search" aria-label="Search tasks by name" placeholder="Search tasks by name…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }}/>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select aria-label="Filter tasks by status" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            <option value="">All statuses</option>
            {TASK_STATUSES.map((s) => (<option key={s}>{s}</option>))}
          </Select>
          <Select aria-label="Filter tasks by priority" value={priority} onChange={(e) => { setPriority(e.target.value); resetPage(); }}>
            <option value="">All priorities</option>
            {TASK_PRIORITIES.map((p) => (<option key={p}>{p}</option>))}
          </Select>
          {!projectId && (<Select aria-label="Filter tasks by project" className="col-span-2 sm:col-span-1" value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); resetPage(); }}>
              <option value="">All projects</option>
              {(projectsData?.data ?? []).map((p) => (<option key={p.id} value={p.id}>
                  {p.name}
                </option>))}
            </Select>)}
        </div>
        <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}>
          <Plus className="h-4 w-4"/> Add task
        </Button>
      </div>

      {error && data && <StaleBanner error={error} onRetry={() => mutate()}/>}
      {error && !data ? (<ErrorState error={error} onRetry={() => mutate()}/>) : isLoading && !data ? (<div className="space-y-3" aria-busy="true" aria-label="Loading tasks">
          {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24"/>))}
        </div>) : tasks.length === 0 ? (filtered ? (<EmptyState icon={<Search className="h-5 w-5"/>} title="No matching tasks" description="Nothing matches your search and filters." action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}/>) : (<EmptyState icon={<ListChecks className="h-5 w-5"/>} title="No tasks yet" description={projectId ? "Add the first task to this project." : "Add a task to one of your projects to get started."} action={<Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus className="h-4 w-4"/> Add task</Button>}/>)) : (<>
          <ul className="space-y-3">
            {tasks.map((t) => (<TaskItem key={t.id} task={t} showProject={!projectId} onEdit={() => { setEditing(t); setFormOpen(true); }} onDelete={() => setDeleting(t)}/>))}
          </ul>
          <Pagination meta={data?.meta} onPage={setPage}/>
        </>)}

      <TaskFormDialog open={formOpen} onClose={() => setFormOpen(false)} task={editing} projectId={projectId ?? (projectFilter || undefined)} lockProject={Boolean(projectId) && !editing}/>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={confirmDelete} title="Delete this task?" description={deleting ? `“${deleting.name}” will be permanently deleted.` : ""} confirmLabel="Delete task"/>
    </section>);
}
