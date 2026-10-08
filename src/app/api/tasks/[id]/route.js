import { withAuthParams } from "@/lib/api/handler";
import { parseBody, parseId } from "@/lib/api/parse";
import { ok } from "@/lib/api/response";
import { deleteTask, getTask, updateTask } from "@/lib/db/tasks";
import { updateTaskSchema } from "@/validations/task";
export const GET = withAuthParams(async ({ supabase, params }) => {
    return ok(await getTask(supabase, parseId(params.id, "task id")));
});
export const PUT = withAuthParams(async ({ request, supabase, params }) => {
    const id = parseId(params.id, "task id");
    const input = await parseBody(request, updateTaskSchema);
    return ok(await updateTask(supabase, id, input));
});
export const DELETE = withAuthParams(async ({ supabase, params }) => {
    return ok(await deleteTask(supabase, parseId(params.id, "task id")));
});
