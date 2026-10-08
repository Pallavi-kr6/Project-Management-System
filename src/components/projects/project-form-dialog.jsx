"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { revalidateData } from "@/hooks/use-api";
import { api, ApiClientError, fieldErrors } from "@/lib/api/client";
import { PROJECT_STATUSES } from "@/lib/constants";
import { zodFieldErrors } from "@/lib/forms";
import { createProjectSchema } from "@/validations/project";
export function ProjectFormDialog({ open, onClose, project, onSaved }) {
    return (<Dialog open={open} onClose={onClose} title={project ? "Edit project" : "New project"} description={project ? "Update the project details." : "Create a project to organise your tasks."}>
      <ProjectForm project={project} onClose={onClose} onSaved={onSaved}/>
    </Dialog>);
}
function ProjectForm({ project, onClose, onSaved }) {
    const toast = useToast();
    const [values, setValues] = useState({
        name: project?.name ?? "",
        description: project?.description ?? "",
        status: (project?.status ?? "Not Started"),
        startDate: project?.startDate ?? "",
        endDate: project?.endDate ?? "",
    });
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState(null);
    const [loading, setLoading] = useState(false);
    async function onSubmit(e) {
        e.preventDefault();
        setFormError(null);
        const payload = {
            name: values.name,
            description: values.description,
            status: values.status,
            startDate: values.startDate || null,
            endDate: values.endDate || null,
        };
        const parsed = createProjectSchema.safeParse(payload);
        if (!parsed.success)
            return setErrors(zodFieldErrors(parsed.error));
        setErrors({});
        setLoading(true);
        try {
            const { data } = project ? await api.projects.update(project.id, parsed.data) : await api.projects.create(parsed.data);
            await revalidateData();
            toast({ title: project ? "Project updated" : "Project created", description: data.name });
            onSaved?.(data);
            onClose();
        }
        catch (err) {
            setErrors(fieldErrors(err));
            setFormError(err instanceof ApiClientError ? err.message : "Could not save the project.");
        }
        finally {
            setLoading(false);
        }
    }
    return (<form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && (<p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>)}
      <Field label="Project name" error={errors.name}>
        {(p) => <Input {...p} value={values.name} maxLength={120} autoFocus onChange={(e) => setValues({ ...values, name: e.target.value })} placeholder="e.g. Website redesign"/>}
      </Field>
      <Field label="Description" error={errors.description}>
        {(p) => <Textarea {...p} value={values.description} maxLength={2000} onChange={(e) => setValues({ ...values, description: e.target.value })} placeholder="What is this project about?"/>}
      </Field>
      <Field label="Status" error={errors.status}>
        {(p) => (<Select {...p} value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value })}>
            {PROJECT_STATUSES.map((s) => (<option key={s}>{s}</option>))}
          </Select>)}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" error={errors.startDate}>
          {(p) => <Input {...p} type="date" value={values.startDate} onChange={(e) => setValues({ ...values, startDate: e.target.value })}/>}
        </Field>
        <Field label="End date" error={errors.endDate}>
          {(p) => <Input {...p} type="date" value={values.endDate} min={values.startDate || undefined} onChange={(e) => setValues({ ...values, endDate: e.target.value })}/>}
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {project ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>);
}
