import { createClient } from "@/lib/supabase/server";
import { ApiError } from "./errors";
import { handleError } from "./response";
function logRequest(request, status, startedAt) {
    if (process.env.NODE_ENV === "test")
        return;
    console.log(JSON.stringify({
        level: "info",
        method: request.method,
        path: request.nextUrl.pathname,
        status,
        ms: Date.now() - startedAt,
    }));
}
async function run(request, exec) {
    const startedAt = Date.now();
    let response;
    try {
        response = await exec();
    }
    catch (error) {
        response = handleError(error);
    }
    logRequest(request, response.status, startedAt);
    return response;
}
/** Route that does not require a session (register, login, logout). */
export function publicRoute(handler) {
    return (request) => run(request, async () => handler({ request, supabase: await createClient() }));
}
async function authenticate(request) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error?.name === "AuthRetryableFetchError") {
        throw new ApiError(503, "SERVICE_UNAVAILABLE", "Authentication service is unreachable. Try again shortly.");
    }
    if (error && error.name !== "AuthSessionMissingError") {
        throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
    }
    if (!data?.user) {
        throw new ApiError(401, "UNAUTHORIZED", "You must be signed in to access this resource.");
    }
    return { request, supabase, user: data.user };
}
/**
 * Route that requires a signed-in user. Authentication middleware for the API:
 * validates the session with Supabase Auth, answers 401 otherwise, and hands the
 * handler a Supabase client bound to that user (so RLS applies to every query).
 */
export function withAuth(handler) {
    return (request) => run(request, async () => handler({ ...(await authenticate(request)), params: {} }));
}
/** Same as withAuth, for dynamic routes such as /api/projects/[id]. */
export function withAuthParams(handler) {
    return (request, context) => run(request, async () => {
        const auth = await authenticate(request);
        return handler({ ...auth, params: await context.params });
    });
}
