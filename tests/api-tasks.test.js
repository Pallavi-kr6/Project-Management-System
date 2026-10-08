import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, current, PROJECT_ID, req, TASK_ID, taskRow, useFake, USER_A } from "./helpers/fake-supabase";
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => current.client }));
import { DELETE, GET as getOne, PUT } from "@/app/api/tasks/[id]/route";
import { GET as list, POST } from "@/app/api/tasks/route";
const NONE = { data: null, error: null };
const OWNED_PROJECT = { data: { id: PROJECT_ID }, error: null };
beforeEach(() => useFake());
describe("authentication on /api/tasks", () => {
    it("returns 401 when signed out", async () => {
        expect((await list(req("/api/tasks"))).status).toBe(401);
        expect((await POST(req("/api/tasks", { method: "POST", body: {} }))).status).toBe(401);
        expect((await getOne(req(`/api/tasks/${TASK_ID}`), ctx({ id: TASK_ID }))).status).toBe(401);
        expect((await DELETE(req(`/api/tasks/${TASK_ID}`, { method: "DELETE" }), ctx({ id: TASK_ID }))).status).toBe(401);
    });
});
describe("POST /api/tasks", () => {
    it("validates input (400)", async () => {
        useFake({ user: USER_A });
        const bad = [
            {},
            { name: "no project" },
            { projectId: "nope", name: "x" },
            { projectId: PROJECT_ID, name: "" },
            { projectId: PROJECT_ID, name: "x", priority: "Urgent" },
            { projectId: PROJECT_ID, name: "x", status: "Done" },
            { projectId: PROJECT_ID, name: "x", dueDate: "tomorrow" },
        ];
        for (const body of bad) {
            const res = await POST(req("/api/tasks", { method: "POST", body }));
            expect(res.status).toBe(400);
        }
    });
    it("returns 404 when the project belongs to someone else", async () => {
        const fake = useFake({ user: USER_A, tables: { projects: NONE } });
        const res = await POST(req("/api/tasks", { method: "POST", body: { projectId: PROJECT_ID, name: "Sneaky" } }));
        expect(res.status).toBe(404);
        expect((await res.json()).error.code).toBe("PROJECT_NOT_FOUND");
        expect(fake.calls.some(([m]) => m === "insert")).toBe(false); // never reached the insert
    });
    it("creates a task in an owned project (201)", async () => {
        useFake({ user: USER_A, tables: { projects: OWNED_PROJECT, tasks: { data: taskRow(), error: null } } });
        const res = await POST(req("/api/tasks", { method: "POST", body: { projectId: PROJECT_ID, name: "Design homepage", priority: "High", dueDate: "2026-10-15" } }));
        const json = await res.json();
        expect(res.status).toBe(201);
        expect(json.data).toMatchObject({ id: TASK_ID, projectId: PROJECT_ID, priority: "High", status: "Pending", dueDate: "2026-10-15", project: { name: "Website Redesign" } });
    });
});
describe("GET /api/tasks", () => {
    it("applies status, priority, project and search filters", async () => {
        const fake = useFake({ user: USER_A, tables: { tasks: { data: [taskRow()], error: null, count: 1 } } });
        const res = await list(req(`/api/tasks?status=Pending&priority=High&projectId=${PROJECT_ID}&search=home`));
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.meta.total).toBe(1);
        expect(fake.calls).toContainEqual(["eq", ["status", "Pending"]]);
        expect(fake.calls).toContainEqual(["eq", ["priority", "High"]]);
        expect(fake.calls).toContainEqual(["eq", ["project_id", PROJECT_ID]]);
        expect(fake.calls).toContainEqual(["ilike", ["name", "%home%"]]);
    });
    it("rejects invalid filters (400)", async () => {
        useFake({ user: USER_A });
        expect((await list(req("/api/tasks?priority=Urgent"))).status).toBe(400);
        expect((await list(req("/api/tasks?projectId=abc"))).status).toBe(400);
    });
});
describe("authorization: other users' tasks (IDOR)", () => {
    it("GET/PUT/DELETE return 404 for a task RLS hides", async () => {
        useFake({ user: USER_A, tables: { tasks: NONE } });
        const g = await getOne(req(`/api/tasks/${TASK_ID}`), ctx({ id: TASK_ID }));
        expect(g.status).toBe(404);
        expect((await g.json()).error.code).toBe("TASK_NOT_FOUND");
        expect((await PUT(req(`/api/tasks/${TASK_ID}`, { method: "PUT", body: { status: "Completed" } }), ctx({ id: TASK_ID }))).status).toBe(404);
        expect((await DELETE(req(`/api/tasks/${TASK_ID}`, { method: "DELETE" }), ctx({ id: TASK_ID }))).status).toBe(404);
    });
    it("cannot move a task into a project the user does not own", async () => {
        const fake = useFake({ user: USER_A, tables: { projects: NONE } });
        const res = await PUT(req(`/api/tasks/${TASK_ID}`, { method: "PUT", body: { projectId: PROJECT_ID } }), ctx({ id: TASK_ID }));
        expect(res.status).toBe(404);
        expect((await res.json()).error.code).toBe("PROJECT_NOT_FOUND");
        expect(fake.calls.some(([m]) => m === "update")).toBe(false);
    });
    it("rejects malformed ids (400)", async () => {
        useFake({ user: USER_A });
        expect((await getOne(req("/api/tasks/xyz"), ctx({ id: "xyz" }))).status).toBe(400);
    });
    it("owner can change status and priority, and delete", async () => {
        useFake({ user: USER_A, tables: { tasks: [{ data: taskRow({ status: "Completed", priority: "Low" }), error: null }, { data: { id: TASK_ID }, error: null }] } });
        const put = await PUT(req(`/api/tasks/${TASK_ID}`, { method: "PUT", body: { status: "Completed", priority: "Low" } }), ctx({ id: TASK_ID }));
        expect(put.status).toBe(200);
        expect((await put.json()).data).toMatchObject({ status: "Completed", priority: "Low" });
        const del = await DELETE(req(`/api/tasks/${TASK_ID}`, { method: "DELETE" }), ctx({ id: TASK_ID }));
        expect(del.status).toBe(200);
    });
    it("PUT rejects invalid enum values (400)", async () => {
        useFake({ user: USER_A });
        expect((await PUT(req(`/api/tasks/${TASK_ID}`, { method: "PUT", body: { status: "Done" } }), ctx({ id: TASK_ID }))).status).toBe(400);
    });
});
