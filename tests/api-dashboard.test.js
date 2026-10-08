import { beforeEach, describe, expect, it, vi } from "vitest";
import { current, projectRow, req, taskRow, useFake, USER_A } from "./helpers/fake-supabase";
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => current.client }));
import { GET } from "@/app/api/dashboard/route";
beforeEach(() => useFake());
describe("GET /api/dashboard", () => {
    it("returns 401 when signed out", async () => {
        const res = await GET(req("/api/dashboard"));
        expect(res.status).toBe(401);
    });
    it("builds the dashboard from database aggregates", async () => {
        const fake = useFake({
            user: USER_A,
            rpc: {
                get_dashboard_stats: {
                    data: {
                        totalProjects: 3,
                        totalTasks: 9,
                        projectsByStatus: { "Not Started": 1, "In Progress": 2 },
                        tasksByStatus: { Pending: 3, "In Progress": 2, Completed: 4 },
                    },
                    error: null,
                },
            },
            tables: {
                tasks: { data: [taskRow()], error: null },
                projects_with_stats: { data: [projectRow()], error: null },
            },
        });
        const res = await GET(req("/api/dashboard"));
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.data.stats).toEqual({ totalProjects: 3, totalTasks: 9, completedTasks: 4, pendingTasks: 3, inProgressTasks: 2, projectsInProgress: 2 });
        expect(json.data.projectStatusDistribution).toEqual({ "Not Started": 1, "In Progress": 2, Completed: 0 });
        expect(json.data.upcomingTasks[0].name).toBe("Design homepage");
        expect(json.data.recentProjects[0].name).toBe("Website Redesign");
        expect(fake.calls).toContainEqual(["rpc", ["get_dashboard_stats"]]);
    });
    it("returns zeros for a user with no data", async () => {
        useFake({ user: USER_A, rpc: { get_dashboard_stats: { data: { totalProjects: 0, totalTasks: 0, projectsByStatus: {}, tasksByStatus: {} }, error: null } }, tables: { tasks: { data: [], error: null }, projects_with_stats: { data: [], error: null } } });
        const json = await (await GET(req("/api/dashboard"))).json();
        expect(json.data.stats.totalProjects).toBe(0);
        expect(json.data.upcomingTasks).toEqual([]);
    });
    it("surfaces a safe 500 if the aggregate query fails", async () => {
        useFake({ user: USER_A, rpc: { get_dashboard_stats: { data: null, error: { code: "42883", message: "function does not exist" } } }, tables: { tasks: { data: [], error: null }, projects_with_stats: { data: [], error: null } } });
        const res = await GET(req("/api/dashboard"));
        expect(res.status).toBe(500);
        expect(JSON.stringify(await res.json())).not.toContain("function does not exist");
    });
});
