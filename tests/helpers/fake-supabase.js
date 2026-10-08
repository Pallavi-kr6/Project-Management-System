import { NextRequest } from "next/server";
const EMPTY = { data: null, error: null, count: 0 };
/** A chainable, awaitable stand-in for a PostgREST query builder that records every call. */
function fakeQuery(result, calls) {
    const q = new Proxy({}, {
        get(_t, prop) {
            if (prop === "then") {
                return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
            }
            return (...args) => {
                calls.push([prop, args]);
                return q;
            };
        },
    });
    return q;
}
export function createFakeSupabase(options = {}) {
    const calls = [];
    const counters = {};
    const user = options.user === undefined ? null : options.user;
    const client = {
        auth: {
            getUser: async () => {
                if (options.authError)
                    return { data: { user: null }, error: options.authError };
                if (!user) {
                    return { data: { user: null }, error: { name: "AuthSessionMissingError", message: "Auth session missing!" } };
                }
                return { data: { user }, error: null };
            },
            signOut: async () => ({ error: null }),
            ...options.auth,
        },
        from(table) {
            calls.push(["from", [table]]);
            const entry = options.tables?.[table];
            let result = EMPTY;
            if (Array.isArray(entry)) {
                const i = counters[table] ?? 0;
                counters[table] = i + 1;
                result = entry[Math.min(i, entry.length - 1)] ?? EMPTY;
            }
            else if (entry) {
                result = entry;
            }
            return fakeQuery(result, calls);
        },
        rpc(name) {
            calls.push(["rpc", [name]]);
            return fakeQuery(options.rpc?.[name] ?? EMPTY, calls);
        },
    };
    return { client, calls };
}
/** Holder read by the vi.mock factory in each test file. */
export const current = { client: null };
export function useFake(options = {}) {
    const fake = createFakeSupabase(options);
    current.client = fake.client;
    return fake;
}
export const USER_A = { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email: "alice@example.test", user_metadata: {} };
export const PROJECT_ID = "a1000000-0000-0000-0000-000000000001";
export const TASK_ID = "a2000000-0000-0000-0000-000000000001";
export function req(path, init = {}) {
    const headers = { ...(init.headers ?? {}) };
    let body;
    if (init.rawBody !== undefined)
        body = init.rawBody;
    else if (init.body !== undefined)
        body = JSON.stringify(init.body);
    if (body !== undefined && !headers["content-type"])
        headers["content-type"] = "application/json";
    return new NextRequest(`http://localhost${path}`, { method: init.method ?? "GET", headers, body });
}
export const ctx = (params) => ({ params: Promise.resolve(params) });
export const projectRow = (over = {}) => ({
    id: PROJECT_ID,
    owner_id: USER_A.id,
    name: "Website Redesign",
    description: "Redesign company website",
    status: "Not Started",
    start_date: "2026-10-01",
    end_date: "2026-11-01",
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    total_tasks: 4,
    completed_tasks: 1,
    ...over,
});
export const taskRow = (over = {}) => ({
    id: TASK_ID,
    project_id: PROJECT_ID,
    name: "Design homepage",
    description: "",
    priority: "High",
    status: "Pending",
    due_date: "2026-10-15",
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    project: { id: PROJECT_ID, name: "Website Redesign" },
    ...over,
});
