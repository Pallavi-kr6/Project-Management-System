import { withAuthParams } from "@/lib/api/handler";
import { parseBody, parseId } from "@/lib/api/parse";
import { ok } from "@/lib/api/response";
import { deleteProject, getProject, updateProject } from "@/lib/db/projects";
import { updateProjectSchema } from "@/validations/project";
export const GET = withAuthParams(async ({ supabase, params }) => {
    return ok(await getProject(supabase, parseId(params.id, "project id")));
});
export const PUT = withAuthParams(async ({ request, supabase, params }) => {
    const id = parseId(params.id, "project id");
    const input = await parseBody(request, updateProjectSchema);
    return ok(await updateProject(supabase, id, input));
});
export const DELETE = withAuthParams(async ({ supabase, params }) => {
    return ok(await deleteProject(supabase, parseId(params.id, "project id")));
});
