/**
 * Integration tests: the REAL data-access layer (src/lib/db/*) -> PostgREST -> PostgreSQL
 * with the real schema.sql and RLS. Each user is represented by a signed JWT, exactly like
 * Supabase issues them, so `auth.uid()` and the `authenticated` role behave as in production.
 */
import { createHmac } from "node:crypto";
import { PostgrestClient } from "@supabase/postgrest-js";
import { beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { getDashboard } from "@/lib/db/dashboard";
import { createProject, deleteProject, getProject, listProjects, updateProject } from "@/lib/db/projects";
import { createTask, deleteTask, getTask, listTasks, updateTask } from "@/lib/db/tasks";
import { projectListQuerySchema } from "@/validations/project";
import { taskListQuerySchema } from "@/validations/task";
const URL_ = process.env.PGRST_URL ?? "http://localhost:3200";
const SECRET = process.env.PGRST_JWT_SECRET ?? "";
const ALICE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(sub, role = "authenticated") {
    const head = b64({ alg: "HS256", typ: "JWT" });
    const body = b64({ sub, role, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
    const sig = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
    return `${head}.${body}.${sig}`;
}
const clientFor = (sub) => new PostgrestClient(URL_, { headers: { Authorization: `Bearer ${jwt(sub)}` } });
const alice = clientFor(ALICE);
const bob = clientFor(BOB);
const anon = new PostgrestClient(URL_);
const pq = (o = {}) => projectListQuerySchema.parse(o);
const tq = (o = {}) => taskListQuerySchema.parse(o);
async function expectApiError(promise, status, code) {
    const err = await promise.then(() => null, (e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(status);
    if (code)
        expect(err.code).toBe(code);
}
let aliceProjectId = "";
let aliceTaskId = "";
let bobProjectId = "";
beforeAll(() => {
    if (!SECRET)
        throw new Error("PGRST_JWT_SECRET is not set - run via scripts/test-integration.sh");
});
describe("projects (real DB + RLS)", () => {
    it("creates a project owned by the caller and returns it with task counts", async () => {
        const p = await createProject(alice, ALICE, { name: "Website Redesign", description: "Redesign", status: "In Progress", startDate: "2026-10-01", endDate: "2026-11-01" });
        aliceProjectId = p.id;
        expect(p).toMatchObject({ name: "Website Redesign", status: "In Progress", startDate: "2026-10-01", endDate: "2026-11-01", totalTasks: 0, completedTasks: 0 });
        const b = await createProject(bob, BOB, { name: "Bob's Secret Project" });
        bobProjectId = b.id;
    });
    it("applies DB defaults when optional fields are omitted", async () => {
        const p = await createProject(alice, ALICE, { name: "Minimal" });
        expect(p).toMatchObject({ description: "", status: "Not Started", startDate: null, endDate: null });
    });
    it("cannot create a project for another owner (RLS WITH CHECK)", async () => {
        await expectApiError(createProject(alice, BOB, { name: "Forged" }), 403, "FORBIDDEN");
    });
    it("lists only the caller's projects", async () => {
        const a = await listProjects(alice, pq());
        expect(a.items.map((p) => p.name).sort()).toEqual(["Minimal", "Website Redesign"]);
        expect(a.total).toBe(2);
        const b = await listProjects(bob, pq());
        expect(b.items.map((p) => p.name)).toEqual(["Bob's Secret Project"]);
    });
    it("an anonymous caller gets nothing / an error, never data", async () => {
        await expect(listProjects(anon, pq())).rejects.toBeInstanceOf(ApiError);
    });
    it("IDOR: another user's project id behaves as 'not found' for get, update and delete", async () => {
        await expectApiError(getProject(bob, aliceProjectId), 404, "PROJECT_NOT_FOUND");
        await expectApiError(updateProject(bob, aliceProjectId, { name: "Hacked" }), 404, "PROJECT_NOT_FOUND");
        await expectApiError(deleteProject(bob, aliceProjectId), 404, "PROJECT_NOT_FOUND");
        expect((await getProject(alice, aliceProjectId)).name).toBe("Website Redesign"); // untouched
    });
    it("searches by name case-insensitively, treating % and _ literally", async () => {
        expect((await listProjects(alice, pq({ search: "website" }))).items).toHaveLength(1);
        expect((await listProjects(alice, pq({ search: "%" }))).items).toHaveLength(0);
        expect((await listProjects(alice, pq({ search: "_" }))).items).toHaveLength(0);
        expect((await listProjects(alice, pq({ search: "nothing-matches" }))).total).toBe(0);
    });
    it("filters by status, sorts, and paginates with an exact total", async () => {
        expect((await listProjects(alice, pq({ status: "In Progress" }))).items.map((p) => p.name)).toEqual(["Website Redesign"]);
        const page1 = await listProjects(alice, pq({ pageSize: 1, page: 1, sort: "name", order: "asc" }));
        const page2 = await listProjects(alice, pq({ pageSize: 1, page: 2, sort: "name", order: "asc" }));
        expect(page1.items[0]?.name).toBe("Minimal");
        expect(page2.items[0]?.name).toBe("Website Redesign");
        expect(page1.total).toBe(2);
    });
    it("updates, and rejects an end date before the start date", async () => {
        const p = await updateProject(alice, aliceProjectId, { status: "Completed" });
        expect(p.status).toBe("Completed");
        await updateProject(alice, aliceProjectId, { status: "In Progress" });
        await expectApiError(updateProject(alice, aliceProjectId, { endDate: "2020-01-01" }), 400, "INVALID_DATE_RANGE");
    });
});
describe("tasks (real DB + RLS)", () => {
    it("creates tasks in an owned project, with the project embedded", async () => {
        const t = await createTask(alice, { projectId: aliceProjectId, name: "Design homepage", priority: "High", dueDate: "2026-10-15" });
        aliceTaskId = t.id;
        expect(t).toMatchObject({ projectId: aliceProjectId, status: "Pending", priority: "High", dueDate: "2026-10-15", project: { id: aliceProjectId, name: "Website Redesign" } });
        await createTask(alice, { projectId: aliceProjectId, name: "Write copy", priority: "Low", status: "In Progress" });
        await createTask(alice, { projectId: aliceProjectId, name: "Launch 100%_ready", priority: "Medium", status: "Completed", dueDate: "2026-09-01" });
    });
    it("IDOR: cannot create a task in another user's project", async () => {
        await expectApiError(createTask(bob, { projectId: aliceProjectId, name: "Injected" }), 404, "PROJECT_NOT_FOUND");
    });
    it("IDOR: another user's task is invisible for get, update and delete", async () => {
        await expectApiError(getTask(bob, aliceTaskId), 404, "TASK_NOT_FOUND");
        await expectApiError(updateTask(bob, aliceTaskId, { status: "Completed" }), 404, "TASK_NOT_FOUND");
        await expectApiError(deleteTask(bob, aliceTaskId), 404, "TASK_NOT_FOUND");
        expect((await getTask(alice, aliceTaskId)).status).toBe("Pending");
    });
    it("cannot move a task into another user's project", async () => {
        await expectApiError(updateTask(alice, aliceTaskId, { projectId: bobProjectId }), 404, "PROJECT_NOT_FOUND");
        expect((await getTask(alice, aliceTaskId)).projectId).toBe(aliceProjectId);
    });
    it("lists, searches and filters by status, priority and project", async () => {
        expect((await listTasks(alice, tq())).total).toBe(3);
        expect((await listTasks(bob, tq())).total).toBe(0);
        expect((await listTasks(alice, tq({ search: "HOME" }))).items.map((t) => t.name)).toEqual(["Design homepage"]);
        expect((await listTasks(alice, tq({ search: "100%_" }))).items).toHaveLength(1); // literal match
        expect((await listTasks(alice, tq({ search: "%" }))).items).toHaveLength(1); // only the name that contains a real '%'
        expect((await listTasks(alice, tq({ status: "Completed" }))).items).toHaveLength(1);
        expect((await listTasks(alice, tq({ priority: "High" }))).items.map((t) => t.name)).toEqual(["Design homepage"]);
        expect((await listTasks(alice, tq({ status: "In Progress", priority: "Low" }))).items).toHaveLength(1);
        expect((await listTasks(alice, tq({ projectId: aliceProjectId }))).total).toBe(3);
        expect((await listTasks(bob, tq({ projectId: aliceProjectId }))).total).toBe(0);
    });
    it("changes status and priority, and marks a task completed", async () => {
        const t = await updateTask(alice, aliceTaskId, { status: "Completed", priority: "Low" });
        expect(t).toMatchObject({ status: "Completed", priority: "Low" });
    });
    it("project stats reflect task counts", async () => {
        const p = await getProject(alice, aliceProjectId);
        expect(p.totalTasks).toBe(3);
        expect(p.completedTasks).toBe(2);
    });
});
describe("dashboard (real aggregates)", () => {
    it("is computed from the caller's own rows only", async () => {
        const a = await getDashboard(alice);
        expect(a.stats).toEqual({ totalProjects: 2, totalTasks: 3, completedTasks: 2, pendingTasks: 0, inProgressTasks: 1, projectsInProgress: 1 });
        expect(a.taskStatusDistribution).toEqual({ Pending: 0, "In Progress": 1, Completed: 2 });
        expect(a.recentProjects).toHaveLength(2);
        expect(a.upcomingTasks.every((t) => t.status !== "Completed" && t.dueDate)).toBe(true);
        const b = await getDashboard(bob);
        expect(b.stats).toEqual({ totalProjects: 1, totalTasks: 0, completedTasks: 0, pendingTasks: 0, inProgressTasks: 0, projectsInProgress: 0 });
    });
    it("updates after changes (pending count appears when a task is reopened)", async () => {
        await updateTask(alice, aliceTaskId, { status: "Pending" });
        expect((await getDashboard(alice)).stats).toMatchObject({ pendingTasks: 1, completedTasks: 1 });
    });
});
describe("deletion", () => {
    it("deleting a project cascades to its tasks; another user cannot delete it", async () => {
        await expectApiError(deleteProject(bob, aliceProjectId), 404);
        expect(await deleteProject(alice, aliceProjectId)).toEqual({ id: aliceProjectId });
        expect((await listTasks(alice, tq())).total).toBe(0);
        expect((await getDashboard(alice)).stats.totalTasks).toBe(0);
    });
    it("a task can be deleted by its owner", async () => {
        const t = await createTask(bob, { projectId: bobProjectId, name: "Temp" });
        expect(await deleteTask(bob, t.id)).toEqual({ id: t.id });
        await expectApiError(getTask(bob, t.id), 404);
    });
});
