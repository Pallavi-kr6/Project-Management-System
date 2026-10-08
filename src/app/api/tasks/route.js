import { withAuth } from "@/lib/api/handler";
import { parseBody, parseQuery } from "@/lib/api/parse";
import { buildMeta, ok } from "@/lib/api/response";
import { createTask, listTasks } from "@/lib/db/tasks";
import { createTaskSchema, taskListQuerySchema } from "@/validations/task";
export const GET = withAuth(async ({ request, supabase }) => {
    const query = parseQuery(request, taskListQuerySchema);
    const { items, total } = await listTasks(supabase, query);
    return ok(items, { meta: buildMeta(query.page, query.pageSize, total) });
});
export const POST = withAuth(async ({ request, supabase }) => {
    const input = await parseBody(request, createTaskSchema);
    return ok(await createTask(supabase, input), { status: 201 });
});
