import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, current, PROJECT_ID, projectRow, req, useFake, USER_A } from "./helpers/fake-supabase";
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => current.client }));
import { DELETE, GET as getOne, PUT } from "@/app/api/projects/[id]/route";
import { GET as list, POST } from "@/app/api/projects/route";
const NONE = { data: null, error: null };
beforeEach(() => useFake());
describe("authentication on /api/projects", () => {
    it("returns 401 for every method when signed out", async () => {
        expect((await list(req("/api/projects"))).status).toBe(401);
        expect((await POST(req("/api/projects", { method: "POST", body: { name: "x" } }))).status).toBe(401);
        expect((await getOne(req(`/api/projects/${PROJECT_ID}`), ctx({ id: PROJECT_ID }))).status).toBe(401);
        expect((await PUT(req(`/api/projects/${PROJECT_ID}`, { method: "PUT", body: { name: "x" } }), ctx({ id: PROJECT_ID }))).status).toBe(401);
        expect((await DELETE(req(`/api/projects/${PROJECT_ID}`, { method: "DELETE" }), ctx({ id: PROJECT_ID }))).status).toBe(401);
    });
});
describe("POST /api/projects", () => {
    it("validates the body on the server (400)", async () => {
        useFake({ user: USER_A });
        const cases = [
            {},
            { name: "   " },
            { name: "ok", status: "Archived" },
            { name: "ok", startDate: "2026-02-31" },
            { name: "ok", startDate: "2026-11-02", endDate: "2026-11-01" },
        ];
        for (const body of cases) {
            const res = await POST(req("/api/projects", { method: "POST", body }));
            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
        }
    });
    it("creates a project owned by the authenticated user, ignoring any client-sent owner (201)", async () => {
        const fake = useFake({
            user: USER_A,
            tables: {
                projects: [
                    { data: { id: PROJECT_ID }, error: null }, // insert ... select id
                    { data: null, error: null }, // placeholder (unused)
                ],
                projects_with_stats: { data: projectRow({ total_tasks: 0, completed_tasks: 0 }), error: null },
            },
        });
        const res = await POST(req("/api/projects", {
            method: "POST",
            body: { name: "Website Redesign", description: "Redesign company website", status: "Not Started", startDate: "2026-10-01", endDate: "2026-11-01", owner_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
        }));
        const json = await res.json();
        expect(res.status).toBe(201);
        expect(json.success).toBe(true);
        expect(json.data).toMatchObject({ id: PROJECT_ID, name: "Website Redesign", status: "Not Started", startDate: "2026-10-01", totalTasks: 0 });
        const insertCall = fake.calls.find(([m]) => m === "insert");
        expect(insertCall?.[1][0]).toMatchObject({ owner_id: USER_A.id });
        expect(JSON.stringify(insertCall?.[1][0])).not.toContain("bbbbbbbb");
    });
});
describe("GET /api/projects", () => {
    it("returns a paginated list with meta", async () => {
        useFake({ user: USER_A, tables: { projects_with_stats: { data: [projectRow()], error: null, count: 23 } } });
        const res = await list(req("/api/projects?page=2&pageSize=10&status=In%20Progress&search=web"));
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.data).toHaveLength(1);
        expect(json.meta).toEqual({ page: 2, pageSize: 10, total: 23, totalPages: 3 });
    });
    it("applies search (escaped), status filter and range using parameterised builder calls", async () => {
        const fake = useFake({ user: USER_A, tables: { projects_with_stats: { data: [], error: null, count: 0 } } });
        await list(req("/api/projects?search=50%25_off&status=Completed&page=3&pageSize=5"));
        expect(fake.calls).toContainEqual(["ilike", ["name", "%50\\%\\_off%"]]);
        expect(fake.calls).toContainEqual(["eq", ["status", "Completed"]]);
        expect(fake.calls).toContainEqual(["range", [10, 14]]);
    });
    it("rejects bad query params (400)", async () => {
        useFake({ user: USER_A });
        expect((await list(req("/api/projects?status=Nope"))).status).toBe(400);
        expect((await list(req("/api/projects?pageSize=9999"))).status).toBe(400);
        expect((await list(req("/api/projects?sort=owner_id"))).status).toBe(400);
    });
    it("hides database details on failure (500 without internals)", async () => {
        useFake({ user: USER_A, tables: { projects_with_stats: { data: null, error: { code: "XX000", message: "secret internal failure" } } } });
        const res = await list(req("/api/projects"));
        const text = await res.text();
        expect(res.status).toBe(500);
        expect(text).not.toContain("secret internal failure");
    });
});
describe("authorization: other users' projects (IDOR)", () => {
    it("rejects malformed ids before touching the database (400)", async () => {
        useFake({ user: USER_A });
        const res = await getOne(req("/api/projects/1;drop"), ctx({ id: "1;drop" }));
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe("INVALID_ID");
    });
    it("GET returns 404 for a project RLS hides (someone else's)", async () => {
        useFake({ user: USER_A, tables: { projects_with_stats: NONE } });
        const res = await getOne(req(`/api/projects/${PROJECT_ID}`), ctx({ id: PROJECT_ID }));
        expect(res.status).toBe(404);
        expect((await res.json()).error.code).toBe("PROJECT_NOT_FOUND");
    });
    it("PUT returns 404 and does not update someone else's project", async () => {
        useFake({ user: USER_A, tables: { projects: NONE } });
        const res = await PUT(req(`/api/projects/${PROJECT_ID}`, { method: "PUT", body: { name: "Hacked" } }), ctx({ id: PROJECT_ID }));
        expect(res.status).toBe(404);
    });
    it("DELETE returns 404 for someone else's project", async () => {
        useFake({ user: USER_A, tables: { projects: NONE } });
        const res = await DELETE(req(`/api/projects/${PROJECT_ID}`, { method: "DELETE" }), ctx({ id: PROJECT_ID }));
        expect(res.status).toBe(404);
    });
    it("PUT with an empty body is a 400, not a no-op", async () => {
        useFake({ user: USER_A });
        const res = await PUT(req(`/api/projects/${PROJECT_ID}`, { method: "PUT", body: {} }), ctx({ id: PROJECT_ID }));
        expect(res.status).toBe(400);
    });
    it("owner can update and delete", async () => {
        useFake({
            user: USER_A,
            tables: {
                projects: { data: { id: PROJECT_ID }, error: null },
                projects_with_stats: { data: projectRow({ status: "In Progress" }), error: null },
            },
        });
        const put = await PUT(req(`/api/projects/${PROJECT_ID}`, { method: "PUT", body: { status: "In Progress" } }), ctx({ id: PROJECT_ID }));
        expect(put.status).toBe(200);
        expect((await put.json()).data.status).toBe("In Progress");
        const del = await DELETE(req(`/api/projects/${PROJECT_ID}`, { method: "DELETE" }), ctx({ id: PROJECT_ID }));
        expect(del.status).toBe(200);
        expect((await del.json()).data).toEqual({ id: PROJECT_ID });
    });
    it("maps a date-order constraint failure from the database to 400", async () => {
        useFake({ user: USER_A, tables: { projects: { data: null, error: { code: "23514", message: 'new row violates check constraint "projects_date_order"' } } } });
        const res = await PUT(req(`/api/projects/${PROJECT_ID}`, { method: "PUT", body: { endDate: "2020-01-01" } }), ctx({ id: PROJECT_ID }));
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe("INVALID_DATE_RANGE");
    });
});
