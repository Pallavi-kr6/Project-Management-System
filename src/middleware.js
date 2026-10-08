import { updateSession } from "@/lib/supabase/middleware";
export async function middleware(request) {
    return updateSession(request);
}
export const config = {
    // Pages only. /api routes authenticate themselves and answer 401 JSON instead of redirecting.
    matcher: ["/", "/login", "/register", "/dashboard/:path*", "/projects/:path*", "/tasks/:path*", "/profile/:path*"],
};
