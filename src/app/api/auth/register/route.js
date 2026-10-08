import { mapAuthError } from "@/lib/api/auth-errors";
import { ApiError } from "@/lib/api/errors";
import { publicRoute } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/parse";
import { ok } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/validations/auth";
export const POST = publicRoute(async ({ request, supabase }) => {
    enforceRateLimit(request, "register", { limit: 5, windowMs: 60 * 60 * 1000 });
    const input = await parseBody(request, registerSchema);
    const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
            data: { full_name: input.fullName },
            emailRedirectTo: new URL("/login", request.nextUrl.origin).toString(),
        },
    });
    if (error)
        throw mapAuthError(error);
    // With "Confirm email" enabled Supabase answers an existing address with a fake user that has no identities.
    if (data.user && data.user.identities?.length === 0) {
        throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists");
    }
    if (!data.user)
        throw new ApiError(500, "REGISTRATION_FAILED", "Could not create the account");
    return ok({
        user: { id: data.user.id, email: data.user.email ?? input.email, fullName: input.fullName },
        requiresEmailConfirmation: !data.session,
    }, { status: 201 });
});
