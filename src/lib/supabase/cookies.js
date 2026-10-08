/**
 * @supabase/ssr issues session cookies that JavaScript can read, because it assumes a browser
 * Supabase client. This app never creates one: the browser only calls our own /api routes, and
 * only the server reads the session. So every auth cookie is hardened:
 *  - HttpOnly: page scripts (and therefore XSS) cannot read the access/refresh tokens
 *  - Secure (production): never sent over plain HTTP
 *  - SameSite=Lax: not sent on cross-site POSTs (CSRF defence)
 */
export function hardenCookieOptions(options = {}) {
    return {
        ...options,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: options.path ?? "/",
    };
}
