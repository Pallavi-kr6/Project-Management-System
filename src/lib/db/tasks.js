import { notFound } from "@/lib/api/errors";
import { escapeLike } from "@/lib/utils";
import { dbError } from "./errors";
import { mapTask, toTaskRow } from "./mappers";
export const TASK_SELECT = "*, project:projects(id, name)";
const SORT_COLUMNS = { createdAt: "created_at", name: "name", dueDate: "due_date" };
const TASK_NOT_FOUND = () => notFound("TASK_NOT_FOUND", "Task not found");
/** Confirms the project exists AND belongs to the caller (RLS hides everyone else's). */
export async function assertProjectAccessible(supabase, projectId) {
    const { data, error } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
    if (error)
        throw dbError(error);
    if (!data)
        throw notFound("PROJECT_NOT_FOUND", "Project not found");
}
export async function listTasks(supabase, q) {
    let query = supabase.from("tasks").select(TASK_SELECT, { count: "exact" });
    if (q.search)
        query = query.ilike("name", `%${escapeLike(q.search)}%`);
    if (q.status)
        query = query.eq("status", q.status);
    if (q.priority)
        query = query.eq("priority", q.priority);
    if (q.projectId)
        query = query.eq("project_id", q.projectId);
    const from = (q.page - 1) * q.pageSize;
    const { data, error, count } = await query
        .order(SORT_COLUMNS[q.sort], { ascending: q.order === "asc", nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, from + q.pageSize - 1);
    if (error)
        throw dbError(error);
    return { items: (data ?? []).map(mapTask), total: count ?? 0 };
}
export async function getTask(supabase, id) {
    const { data, error } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
    if (error)
        throw dbError(error);
    if (!data)
        throw TASK_NOT_FOUND();
    return mapTask(data);
}
export async function createTask(supabase, input) {
    await assertProjectAccessible(supabase, input.projectId);
    const { data, error } = await supabase.from("tasks").insert(toTaskRow(input)).select(TASK_SELECT).single();
    if (error)
        throw dbError(error, "Could not create the task");
    return mapTask(data);
}
export async function updateTask(supabase, id, input) {
    if (input.projectId)
        await assertProjectAccessible(supabase, input.projectId);
    const { data, error } = await supabase
        .from("tasks")
        .update(toTaskRow(input))
        .eq("id", id)
        .select(TASK_SELECT)
        .maybeSingle();
    if (error)
        throw dbError(error, "Could not update the task");
    if (!data)
        throw TASK_NOT_FOUND();
    return mapTask(data);
}
export async function deleteTask(supabase, id) {
    const { data, error } = await supabase.from("tasks").delete().eq("id", id).select("id").maybeSingle();
    if (error)
        throw dbError(error, "Could not delete the task");
    if (!data)
        throw TASK_NOT_FOUND();
    return { id };
}
