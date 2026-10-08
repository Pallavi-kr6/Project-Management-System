import { withAuth } from "@/lib/api/handler";
import { dbError } from "@/lib/db/errors";
import { ok } from "@/lib/api/response";
export const GET = withAuth(async ({ supabase, user }) => {
    const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, created_at")
        .eq("id", user.id)
        .maybeSingle();
    if (error)
        throw dbError(error);
    const profile = data;
    return ok({
        user: {
            id: user.id,
            email: profile?.email ?? user.email ?? "",
            fullName: profile?.full_name ?? user.user_metadata?.full_name ?? "",
            createdAt: profile?.created_at ?? user.created_at,
        },
    });
});
