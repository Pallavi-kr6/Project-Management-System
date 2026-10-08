import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/validations/auth";
import { isoDateSchema, uuidSchema } from "@/validations/common";
import { createProjectSchema, projectListQuerySchema, updateProjectSchema } from "@/validations/project";
import { createTaskSchema, taskListQuerySchema, updateTaskSchema } from "@/validations/task";
const PID = "a1000000-0000-0000-0000-000000000001";
describe("authentication validation", () => {
    const valid = { fullName: "Alice Test", email: "Alice@Example.test", password: "Passw0rdOK" };
    it("accepts a valid registration and normalises the email", () => {
        const r = registerSchema.safeParse(valid);
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data.email).toBe("alice@example.test");
    });
    it.each([
        ["missing full name", { ...valid, fullName: undefined }],
        ["blank full name", { ...valid, fullName: "   " }],
        ["invalid email", { ...valid, email: "not-an-email" }],
        ["empty email", { ...valid, email: "" }],
        ["short password", { ...valid, password: "Ab1" }],
        ["password without number", { ...valid, password: "OnlyLetters" }],
        ["password without letter", { ...valid, password: "12345678" }],
        ["password longer than 72 chars", { ...valid, password: "a1".repeat(40) }],
    ])("rejects %s", (_label, body) => {
        expect(registerSchema.safeParse(body).success).toBe(false);
    });
    it("login requires a valid email and a non-empty password", () => {
        expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
        expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
        expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    });
});
describe("shared primitives", () => {
    it("accepts real dates and rejects impossible ones", () => {
        expect(isoDateSchema.safeParse("2026-02-28").success).toBe(true);
        expect(isoDateSchema.safeParse("2028-02-29").success).toBe(true);
        expect(isoDateSchema.safeParse("2026-02-31").success).toBe(false);
        expect(isoDateSchema.safeParse("2026-13-01").success).toBe(false);
        expect(isoDateSchema.safeParse("01/02/2026").success).toBe(false);
        expect(isoDateSchema.safeParse("").success).toBe(false);
    });
    it("validates uuids", () => {
        expect(uuidSchema.safeParse(PID).success).toBe(true);
        expect(uuidSchema.safeParse("1 OR 1=1").success).toBe(false);
        expect(uuidSchema.safeParse("123").success).toBe(false);
    });
});
describe("project validation", () => {
    const valid = { name: "Website Redesign", description: "Redesign", status: "Not Started", startDate: "2026-10-01", endDate: "2026-11-01" };
    it("accepts a valid project and a minimal one", () => {
        expect(createProjectSchema.safeParse(valid).success).toBe(true);
        expect(createProjectSchema.safeParse({ name: "Only a name" }).success).toBe(true);
    });
    it("trims names and rejects empty/oversized ones", () => {
        const r = createProjectSchema.safeParse({ name: "  Padded  " });
        expect(r.success && r.data.name).toBe("Padded");
        expect(createProjectSchema.safeParse({ name: "   " }).success).toBe(false);
        expect(createProjectSchema.safeParse({ name: "x".repeat(121) }).success).toBe(false);
        expect(createProjectSchema.safeParse({}).success).toBe(false);
    });
    it("rejects invalid status values", () => {
        expect(createProjectSchema.safeParse({ ...valid, status: "Archived" }).success).toBe(false);
        expect(createProjectSchema.safeParse({ ...valid, status: "in progress" }).success).toBe(false);
    });
    it("rejects invalid dates and end dates before start dates", () => {
        expect(createProjectSchema.safeParse({ ...valid, startDate: "yesterday" }).success).toBe(false);
        const r = createProjectSchema.safeParse({ ...valid, startDate: "2026-11-02", endDate: "2026-11-01" });
        expect(r.success).toBe(false);
        if (!r.success)
            expect(r.error.issues[0]?.path).toEqual(["endDate"]);
    });
    it("allows null dates", () => {
        expect(createProjectSchema.safeParse({ name: "x", startDate: null, endDate: null }).success).toBe(true);
    });
    it("update requires at least one field and does not apply defaults", () => {
        expect(updateProjectSchema.safeParse({}).success).toBe(false);
        const r = updateProjectSchema.safeParse({ status: "Completed" });
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data).toEqual({ status: "Completed" });
    });
    it("list query applies defaults and bounds", () => {
        const r = projectListQuerySchema.parse({});
        expect(r).toMatchObject({ page: 1, pageSize: 10, sort: "createdAt", order: "desc" });
        expect(projectListQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
        expect(projectListQuerySchema.safeParse({ sort: "owner_id; drop table" }).success).toBe(false);
        expect(projectListQuerySchema.parse({ page: "3" }).page).toBe(3);
    });
});
describe("task validation", () => {
    const valid = { projectId: PID, name: "Design homepage", priority: "High", status: "Pending", dueDate: "2026-10-15" };
    it("accepts a valid task and a minimal one", () => {
        expect(createTaskSchema.safeParse(valid).success).toBe(true);
        expect(createTaskSchema.safeParse({ projectId: PID, name: "Minimal" }).success).toBe(true);
    });
    it("requires a project id that is a uuid", () => {
        expect(createTaskSchema.safeParse({ name: "x" }).success).toBe(false);
        expect(createTaskSchema.safeParse({ ...valid, projectId: "abc" }).success).toBe(false);
    });
    it("rejects empty names, bad enums and bad dates", () => {
        expect(createTaskSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
        expect(createTaskSchema.safeParse({ ...valid, priority: "Urgent" }).success).toBe(false);
        expect(createTaskSchema.safeParse({ ...valid, status: "Done" }).success).toBe(false);
        expect(createTaskSchema.safeParse({ ...valid, dueDate: "2026-02-30" }).success).toBe(false);
    });
    it("update requires at least one field", () => {
        expect(updateTaskSchema.safeParse({}).success).toBe(false);
        expect(updateTaskSchema.safeParse({ status: "Completed" }).success).toBe(true);
    });
    it("list query validates filters", () => {
        expect(taskListQuerySchema.safeParse({ status: "Pending", priority: "Low", projectId: PID }).success).toBe(true);
        expect(taskListQuerySchema.safeParse({ status: "Open" }).success).toBe(false);
        expect(taskListQuerySchema.safeParse({ projectId: "x" }).success).toBe(false);
    });
});
