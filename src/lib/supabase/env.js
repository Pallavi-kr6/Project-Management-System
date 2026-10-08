import { ApiError } from "@/lib/api/errors";
/** Reads the PUBLIC Supabase settings. The service-role key is intentionally never read. */
export function getSupabaseEnv() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        throw new ApiError(500, "CONFIG_ERROR", "The server is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }
    return { url, anonKey };
}
