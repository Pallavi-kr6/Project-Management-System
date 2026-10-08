import { notFound } from "@/lib/api/errors";
import { escapeLike } from "@/lib/utils";
import { dbError } from "./errors";
import { mapProject, toProjectRow } from "./mappers";
// Whitelist: user-supplied sort keys are mapped to real columns, never interpolated.
const SORT_COLUMNS = { createdAt: "created_at", name: "name", startDate: "start_date", endDate: "end_date" };
const PROJECT_NOT_FOUND = () => notFound("PROJECT_NOT_FOUND", "Project not found");
/**
 * All reads go through the `projects_with_stats` view (security_invoker), so row
 * visibility is decided by RLS: other users' projects simply do not exist here.
 */
export async function listProjects(supabase, q) {
    let query = supabase.from("projects_with_stats").select("*", { count: "exact" });
    if (q.search)
        query = query.ilike("name", `%${escapeLike(q.search)}%`);
    if (q.status)
        query = query.eq("status", q.status);
    const from = (q.page - 1) * q.pageSize;
    const { data, error, count } = await query
        .order(SORT_COLUMNS[q.sort], { ascending: q.order === "asc", nullsFirst: false })
        .order("id", { ascending: true }) // stable pagination
        .range(from, from + q.pageSize - 1);
    if (error)
        throw dbError(error);
    return { items: (data ?? []).map(mapProject), total: count ?? 0 };
}
export async function getProject(supabase, id) {
    const { data, error } = await supabase.from("projects_with_stats").select("*").eq("id", id).maybeSingle();
    if (error)
        throw dbError(error);
    if (!data)
        throw PROJECT_NOT_FOUND();
    return mapProject(data);
}
export async function createProject(supabase, userId, input) {
    const { data, error } = await supabase
        .from("projects")
        .insert({ ...toProjectRow(input), owner_id: userId })
        .select("id")
        .single();
    if (error)
        throw dbError(error, "Could not create the project");
    return getProject(supabase, data.id);
}
export async function updateProject(supabase, id, input) {
    const { data, error } = await supabase
        .from("projects")
        .update(toProjectRow(input))
        .eq("id", id)
        .select("id")
        .maybeSingle();
    if (error)
        throw dbError(error, "Could not update the project");
    if (!data)
        throw PROJECT_NOT_FOUND(); // missing OR owned by someone else: indistinguishable on purpose
    return getProject(supabase, id);
}
export async function deleteProject(supabase, id) {
    const { data, error } = await supabase.from("projects").delete().eq("id", id).select("id").maybeSingle();
    if (error)
        throw dbError(error, "Could not delete the project");
    if (!data)
        throw PROJECT_NOT_FOUND();
    return { id };
}
