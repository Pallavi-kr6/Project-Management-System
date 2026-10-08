/** First error message per top-level field, for inline form errors. */
export function zodFieldErrors(error) {
    const out = {};
    for (const issue of error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!out[key])
            out[key] = issue.message;
    }
    return out;
}
/** Only allow same-site relative redirects after login (prevents open-redirect). */
export function safeNextPath(next, fallback = "/dashboard") {
    if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\"))
        return fallback;
    return next;
}
