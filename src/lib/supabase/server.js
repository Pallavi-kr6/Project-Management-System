import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hardenCookieOptions } from "./cookies";
import { getSupabaseEnv } from "./env";
/**
 * Per-request Supabase client for Route Handlers.
 *
 * It uses the ANON key plus the signed-in user's JWT (read from the session
 * cookies), so every query runs as that user and Row Level Security applies.
 * No service-role key is involved anywhere in this application.
 */
export async function createClient() {
    const cookieStore = await cookies();
    const { url, anonKey } = getSupabaseEnv();
    return createServerClient(url, anonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, hardenCookieOptions(options)));
                }
                catch {
                    // Called from a context where cookies are read-only; the middleware refreshes sessions.
                }
            },
        },
    });
}
