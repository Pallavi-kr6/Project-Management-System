"use client";
import { FolderPlus, Plus, Search } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select } from "@/components/ui/form-controls";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, Skeleton, StaleBanner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { revalidateData, useProjects } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { api } from "@/lib/api/client";
import { PROJECT_STATUSES } from "@/lib/constants";
export default function ProjectsPage() {
    const toast = useToast();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const debouncedSearch = useDebounce(search.trim());
    const { data, error, isLoading, mutate } = useProjects({ search: debouncedSearch, status, page, pageSize: 9 });
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState();
    const [deleting, setDeleting] = useState(null);
    const projects = data?.data ?? [];
    const filtered = Boolean(debouncedSearch || status);
    function openCreate() {
        setEditing(undefined);
        setFormOpen(true);
    }
    async function confirmDelete() {
        if (!deleting)
            return;
        try {
            await api.projects.remove(deleting.id);
            await revalidateData();
            toast({ title: "Project deleted", description: `“${deleting.name}” and its tasks were removed.` });
            setDeleting(null);
        }
        catch (e) {
            toast({ variant: "error", title: "Could not delete project", description: e.message });
        }
    }
    return (<>
      <PageHeader title="Projects" description="Everything you are working on." actions={<Button onClick={openCreate}>
            <Plus className="h-4 w-4"/> New project
          </Button>}/>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input type="search" aria-label="Search projects by name" placeholder="Search projects by name…" className="pl-9" value={search} onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
        }}/>
        </div>
        <Select aria-label="Filter projects by status" className="sm:w-48" value={status} onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
        }}>
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((s) => (<option key={s}>{s}</option>))}
        </Select>
      </div>

      {error && data && <StaleBanner error={error} onRetry={() => mutate()}/>}
      {error && !data ? (<ErrorState error={error} onRetry={() => mutate()}/>) : isLoading && !data ? (<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading projects">
          {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-56"/>))}
        </div>) : projects.length === 0 ? (filtered ? (<EmptyState icon={<Search className="h-5 w-5"/>} title="No matching projects" description="Try a different search term or clear the status filter." action={<Button variant="outline" onClick={() => { setSearch(""); setStatus(""); }}>Clear filters</Button>}/>) : (<EmptyState icon={<FolderPlus className="h-5 w-5"/>} title="No projects yet" description="Create your first project to start adding tasks." action={<Button onClick={openCreate}><Plus className="h-4 w-4"/> New project</Button>}/>)) : (<>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (<ProjectCard key={p.id} project={p} onEdit={() => { setEditing(p); setFormOpen(true); }} onDelete={() => setDeleting(p)}/>))}
          </div>
          <Pagination meta={data?.meta} onPage={setPage}/>
        </>)}

      <ProjectFormDialog open={formOpen} onClose={() => setFormOpen(false)} project={editing}/>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={confirmDelete} title="Delete this project?" description={deleting ? `“${deleting.name}” and all ${deleting.totalTasks} of its tasks will be permanently deleted. This cannot be undone.` : ""} confirmLabel="Delete project"/>
    </>);
}
