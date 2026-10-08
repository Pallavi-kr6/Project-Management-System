import { mapAuthError } from "@/lib/api/auth-errors";
import { publicRoute } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/parse";
import { ok } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/validations/auth";
export const POST = publicRoute(async ({ request, supabase }) => {
    // Brute-force protection: 10 attempts per IP per 15 minutes.
    enforceRateLimit(request, "login", { limit: 10, windowMs: 15 * 60 * 1000 });
    const input = await parseBody(request, loginSchema);
    // On success @supabase/ssr stores the session in HttpOnly-capable cookies via the cookie adapter.
    const { data, error } = await supabase.auth.signInWithPassword(input);
    if (error)
        throw mapAuthError(error);
    const user = data.user;
    return ok({
        user: {
            id: user.id,
            email: user.email ?? input.email,
            fullName: user.user_metadata?.full_name ?? "",
        },
    });
});
