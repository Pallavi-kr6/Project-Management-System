import { beforeEach, describe, expect, it } from "vitest";
import { buildDashboardStats } from "@/lib/dashboard";
import { dbError } from "@/lib/db/errors";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";
import { hardenCookieOptions } from "@/lib/supabase/cookies";
import { escapeLike, formatDate, isOverdue, percent, todayISO } from "@/lib/utils";
describe("rate limiter", () => {
    beforeEach(() => resetRateLimits());
    it("allows up to the limit, then blocks with a retry-after", () => {
        const opts = { limit: 3, windowMs: 60_000 };
        const t = 1_000_000;
        expect(checkRateLimit("k", opts, t).allowed).toBe(true);
        expect(checkRateLimit("k", opts, t).allowed).toBe(true);
        expect(checkRateLimit("k", opts, t).allowed).toBe(true);
        const blocked = checkRateLimit("k", opts, t + 1_000);
        expect(blocked.allowed).toBe(false);
        expect(blocked.retryAfterSeconds).toBe(59);
    });
    it("resets after the window and isolates keys", () => {
        const opts = { limit: 1, windowMs: 1_000 };
        expect(checkRateLimit("a", opts, 0).allowed).toBe(true);
        expect(checkRateLimit("a", opts, 10).allowed).toBe(false);
        expect(checkRateLimit("b", opts, 10).allowed).toBe(true);
        expect(checkRateLimit("a", opts, 1_500).allowed).toBe(true);
    });
});
describe("dashboard calculations", () => {
    it("derives every card from the SQL aggregates", () => {
        const r = buildDashboardStats({
            totalProjects: 4,
            totalTasks: 10,
            projectsByStatus: { "Not Started": 1, "In Progress": 2, Completed: 1 },
            tasksByStatus: { Pending: 4, "In Progress": 2, Completed: 4 },
        });
        expect(r.stats).toEqual({
            totalProjects: 4,
            totalTasks: 10,
            completedTasks: 4,
            pendingTasks: 4,
            inProgressTasks: 2,
            projectsInProgress: 2,
        });
        expect(r.taskStatusDistribution).toEqual({ Pending: 4, "In Progress": 2, Completed: 4 });
    });
    it("returns zeros for a brand-new user and tolerates string counts", () => {
        expect(buildDashboardStats({}).stats).toEqual({
            totalProjects: 0, totalTasks: 0, completedTasks: 0, pendingTasks: 0, inProgressTasks: 0, projectsInProgress: 0,
        });
        expect(buildDashboardStats(null).stats.totalTasks).toBe(0);
        expect(buildDashboardStats({ totalTasks: "7", tasksByStatus: { Completed: "3" } }).stats).toMatchObject({
            totalTasks: 7, completedTasks: 3,
        });
    });
});
const pgError = (code, message) => ({ code, message, details: "", hint: "", name: "PostgrestError", toJSON: () => ({}) });
describe("database error mapping", () => {
    it("maps constraint violations to 400 and hides raw messages", () => {
        const e = dbError(pgError("23514", 'violates check constraint "projects_date_order"'));
        expect(e.status).toBe(400);
        expect(e.code).toBe("INVALID_DATE_RANGE");
    });
    it("maps unknown errors to a generic 500", () => {
        const e = dbError(pgError("XX000", "relation secret_table does not exist"));
        expect(e.status).toBe(500);
        expect(e.message).not.toContain("secret_table");
    });
});
describe("utilities", () => {
    it("escapes LIKE wildcards", () => {
        expect(escapeLike("100%_done\\")).toBe("100\\%\\_done\\\\");
    });
    it("formats dates without timezone drift", () => {
        expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
        expect(formatDate(null)).toBe("—");
    });
    it("detects overdue tasks", () => {
        expect(isOverdue("2026-01-01", "Pending", "2026-01-02")).toBe(true);
        expect(isOverdue("2026-01-01", "Completed", "2026-01-02")).toBe(false);
        expect(isOverdue(null, "Pending", "2026-01-02")).toBe(false);
        expect(todayISO(new Date(2026, 0, 5))).toBe("2026-01-05");
    });
    it("computes percentages safely", () => {
        expect(percent(1, 4)).toBe(25);
        expect(percent(0, 0)).toBe(0);
    });
});
describe("session cookie hardening", () => {
    it("forces HttpOnly and SameSite=Lax regardless of library defaults", () => {
        const o = hardenCookieOptions({ httpOnly: false, sameSite: "none", maxAge: 100 });
        expect(o).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 100, path: "/" });
    });
    it("sets Secure only in production", () => {
        const original = process.env.NODE_ENV;
        const env = process.env;
        env.NODE_ENV = "production";
        expect(hardenCookieOptions().secure).toBe(true);
        env.NODE_ENV = "development";
        expect(hardenCookieOptions().secure).toBe(false);
        env.NODE_ENV = original;
    });
});
