import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { hardenCookieOptions } from "./cookies";
const PROTECTED_PREFIXES = ["/dashboard", "/projects", "/tasks", "/profile"];
const AUTH_PAGES = ["/login", "/register"];
const matches = (pathname, prefixes) => prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
/**
 * Runs on every page request: refreshes the Supabase session cookies, then
 *  - sends signed-out visitors away from protected pages to /login
 *  - sends signed-in users away from /login and /register to /dashboard
 * It uses auth.getUser(), which validates the JWT with the Supabase Auth server
 * (getSession() only decodes the cookie and must not be trusted for decisions).
 */
export async function updateSession(request) {
    let response = NextResponse.next({ request });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let isAuthenticated = false;
    if (url && anonKey) {
        const supabase = createServerClient(url, anonKey, {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, hardenCookieOptions(options)));
                },
            },
        });
        try {
            const { data } = await supabase.auth.getUser();
            isAuthenticated = Boolean(data.user);
        }
        catch {
            isAuthenticated = false;
        }
    }
    else {
        console.error("Supabase environment variables are missing; treating visitors as signed out.");
    }
    const { pathname } = request.nextUrl;
    if (!isAuthenticated && matches(pathname, PROTECTED_PREFIXES)) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.search = "";
        loginUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(loginUrl);
    }
    if (isAuthenticated && matches(pathname, AUTH_PAGES)) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = "/dashboard";
        dashboardUrl.search = "";
        return NextResponse.redirect(dashboardUrl);
    }
    return response;
}
