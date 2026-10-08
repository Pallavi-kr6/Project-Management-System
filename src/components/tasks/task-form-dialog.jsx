"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { revalidateData, useProjects } from "@/hooks/use-api";
import { api, ApiClientError, fieldErrors } from "@/lib/api/client";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { zodFieldErrors } from "@/lib/forms";
import { createTaskSchema } from "@/validations/task";
export function TaskFormDialog({ open, onClose, task, projectId, lockProject }) {
    return (<Dialog open={open} onClose={onClose} title={task ? "Edit task" : "New task"} description={task ? "Update the task details." : "Add a task to a project."}>
      <TaskForm task={task} projectId={projectId} lockProject={lockProject} onClose={onClose}/>
    </Dialog>);
}
function TaskForm({ task, projectId, lockProject, onClose }) {
    const toast = useToast();
    const { data: projectsData, error: projectsError, isLoading: projectsLoading } = useProjects({ pageSize: 100 });
    const projects = projectsData?.data ?? [];
    const [values, setValues] = useState({
        projectId: task?.projectId ?? projectId ?? "",
        name: task?.name ?? "",
        description: task?.description ?? "",
        priority: (task?.priority ?? "Medium"),
        status: (task?.status ?? "Pending"),
        dueDate: task?.dueDate ?? "",
    });
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState(null);
    const [loading, setLoading] = useState(false);
    async function onSubmit(e) {
        e.preventDefault();
        setFormError(null);
        const parsed = createTaskSchema.safeParse({ ...values, dueDate: values.dueDate || null });
        if (!parsed.success) {
            const errs = zodFieldErrors(parsed.error);
            if (errs.projectId)
                errs.projectId = "Choose a project";
            return setErrors(errs);
        }
        setErrors({});
        setLoading(true);
        try {
            const { data } = task ? await api.tasks.update(task.id, parsed.data) : await api.tasks.create(parsed.data);
            await revalidateData();
            toast({ title: task ? "Task updated" : "Task created", description: data.name });
            onClose();
        }
        catch (err) {
            setErrors(fieldErrors(err));
            setFormError(err instanceof ApiClientError ? err.message : "Could not save the task.");
        }
        finally {
            setLoading(false);
        }
    }
    const noProjects = !projectsLoading && !projectsError && projects.length === 0;
    return (<form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && (<p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>)}
      {projectsError && (<p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Could not load your projects: {projectsError.message}
        </p>)}
      {noProjects && <p className="rounded-md border bg-muted px-3 py-2 text-sm">Create a project first, then you can add tasks to it.</p>}

      <Field label="Project" error={errors.projectId}>
        {(p) => (<Select {...p} value={values.projectId} disabled={lockProject || projectsLoading} onChange={(e) => setValues({ ...values, projectId: e.target.value })}>
            <option value="">{projectsLoading ? "Loading projects…" : "Select a project"}</option>
            {projects.map((pr) => (<option key={pr.id} value={pr.id}>
                {pr.name}
              </option>))}
            {/* keep the current project selectable even if it falls outside the first 100 */}
            {values.projectId && !projects.some((pr) => pr.id === values.projectId) && task?.project && (<option value={task.project.id}>{task.project.name}</option>)}
          </Select>)}
      </Field>
      <Field label="Task name" error={errors.name}>
        {(p) => <Input {...p} value={values.name} maxLength={160} autoFocus onChange={(e) => setValues({ ...values, name: e.target.value })} placeholder="e.g. Design the homepage"/>}
      </Field>
      <Field label="Description" error={errors.description}>
        {(p) => <Textarea {...p} value={values.description} maxLength={2000} onChange={(e) => setValues({ ...values, description: e.target.value })}/>}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Priority" error={errors.priority}>
          {(p) => (<Select {...p} value={values.priority} onChange={(e) => setValues({ ...values, priority: e.target.value })}>
              {TASK_PRIORITIES.map((x) => (<option key={x}>{x}</option>))}
            </Select>)}
        </Field>
        <Field label="Status" error={errors.status}>
          {(p) => (<Select {...p} value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value })}>
              {TASK_STATUSES.map((x) => (<option key={x}>{x}</option>))}
            </Select>)}
        </Field>
        <Field label="Due date" error={errors.dueDate}>
          {(p) => <Input {...p} type="date" value={values.dueDate} onChange={(e) => setValues({ ...values, dueDate: e.target.value })}/>}
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading} disabled={noProjects}>
          {task ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>);
}
