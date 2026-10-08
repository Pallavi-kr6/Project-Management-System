export class ApiClientError extends Error {
    code;
    status;
    details;
    constructor(code, message, status, details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
        this.name = "ApiClientError";
    }
}
const AUTH_PAGES = ["/login", "/register"];
/**
 * Single entry point for talking to our own REST API.
 * - network failures become ApiClientError("NETWORK_ERROR")
 * - an expired/missing session (401) sends the user back to /login with a message
 */
export async function apiRequest(path, options = {}) {
    let response;
    try {
        response = await fetch(path, {
            method: options.method ?? "GET",
            headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
            credentials: "same-origin",
        });
    }
    catch {
        throw new ApiClientError("NETWORK_ERROR", "Can't reach the server. Check your internet connection and try again.", 0);
    }
    let json = null;
    try {
        json = (await response.json());
    }
    catch {
        /* non-JSON response (e.g. proxy error page) */
    }
    if (response.ok && json?.success)
        return { data: json.data, meta: json.meta };
    const error = json && !json.success ? json.error : undefined;
    if (response.status === 401 && typeof window !== "undefined") {
        const onAuthPage = AUTH_PAGES.some((p) => window.location.pathname.startsWith(p));
        if (!onAuthPage)
            window.location.assign(`/login?reason=${error?.code === "SESSION_EXPIRED" ? "expired" : "signin"}`);
    }
    throw new ApiClientError(error?.code ?? "UNKNOWN_ERROR", error?.message ?? "Something went wrong. Please try again.", response.status, error?.details);
}
export function toQuery(params) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "")
            qs.set(key, String(value));
    }
    const s = qs.toString();
    return s ? `?${s}` : "";
}
export const api = {
    auth: {
        register: (body) => apiRequest("/api/auth/register", { method: "POST", body }),
        login: (body) => apiRequest("/api/auth/login", { method: "POST", body }),
        logout: () => apiRequest("/api/auth/logout", { method: "POST" }),
        me: () => apiRequest("/api/auth/me"),
    },
    projects: {
        list: (p = {}) => apiRequest(`/api/projects${toQuery({ ...p })}`),
        get: (id) => apiRequest(`/api/projects/${id}`),
        create: (body) => apiRequest("/api/projects", { method: "POST", body }),
        update: (id, body) => apiRequest(`/api/projects/${id}`, { method: "PUT", body }),
        remove: (id) => apiRequest(`/api/projects/${id}`, { method: "DELETE" }),
    },
    tasks: {
        list: (p = {}) => apiRequest(`/api/tasks${toQuery({ ...p })}`),
        create: (body) => apiRequest("/api/tasks", { method: "POST", body }),
        update: (id, body) => apiRequest(`/api/tasks/${id}`, { method: "PUT", body }),
        remove: (id) => apiRequest(`/api/tasks/${id}`, { method: "DELETE" }),
    },
    dashboard: { get: () => apiRequest("/api/dashboard") },
};
/** Flattens server field errors into { fieldName: message } for forms. */
export function fieldErrors(error) {
    const out = {};
    if (error instanceof ApiClientError) {
        for (const d of error.details ?? [])
            if (!out[d.field])
                out[d.field] = d.message;
    }
    return out;
}
