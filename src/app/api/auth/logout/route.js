import { publicRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
export const POST = publicRoute(async ({ supabase }) => {
    // Clears the session cookies. Idempotent: calling it while signed out still succeeds.
    await supabase.auth.signOut();
    return ok({ loggedOut: true });
});
