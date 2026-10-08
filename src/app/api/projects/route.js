import { withAuth } from "@/lib/api/handler";
import { parseBody, parseQuery } from "@/lib/api/parse";
import { buildMeta, ok } from "@/lib/api/response";
import { createProject, listProjects } from "@/lib/db/projects";
import { createProjectSchema, projectListQuerySchema } from "@/validations/project";
export const GET = withAuth(async ({ request, supabase }) => {
    const query = parseQuery(request, projectListQuerySchema);
    const { items, total } = await listProjects(supabase, query);
    return ok(items, { meta: buildMeta(query.page, query.pageSize, total) });
});
export const POST = withAuth(async ({ request, supabase, user }) => {
    const input = await parseBody(request, createProjectSchema);
    const project = await createProject(supabase, user.id, input);
    return ok(project, { status: 201 });
});
