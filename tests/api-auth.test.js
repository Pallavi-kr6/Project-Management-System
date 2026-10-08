import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/rate-limit";
import { current, req, useFake, USER_A } from "./helpers/fake-supabase";
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => current.client }));
import { GET as me } from "@/app/api/auth/me/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as register } from "@/app/api/auth/register/route";
const validRegistration = { fullName: "Alice Test", email: "alice@example.test", password: "Passw0rdOK" };
beforeEach(() => {
    resetRateLimits();
    useFake();
});
describe("POST /api/auth/register", () => {
    it("rejects invalid input with field-level details (400)", async () => {
        const res = await register(req("/api/auth/register", { method: "POST", body: { fullName: "", email: "bad", password: "x" } }));
        const json = await res.json();
        expect(res.status).toBe(400);
        expect(json.success).toBe(false);
        expect(json.error.code).toBe("VALIDATION_ERROR");
        expect([...new Set(json.error.details.map((d) => d.field))].sort()).toEqual(["email", "fullName", "password"]);
    });
    it("rejects non-JSON content types (415) and malformed JSON (400)", async () => {
        const wrongType = await register(req("/api/auth/register", { method: "POST", rawBody: "a=b", headers: { "content-type": "text/plain" } }));
        expect(wrongType.status).toBe(415);
        const badJson = await register(req("/api/auth/register", { method: "POST", rawBody: "{oops" }));
        expect(badJson.status).toBe(400);
        expect((await badJson.json()).error.code).toBe("INVALID_JSON");
    });
    it("creates the account and never returns the password (201)", async () => {
        useFake({ auth: { signUp: async () => ({ data: { user: { id: USER_A.id, email: "alice@example.test", identities: [{}] }, session: null }, error: null }) } });
        const res = await register(req("/api/auth/register", { method: "POST", body: validRegistration }));
        const text = await res.text();
        expect(res.status).toBe(201);
        expect(JSON.parse(text).data.requiresEmailConfirmation).toBe(true);
        expect(text).not.toContain("Passw0rdOK");
    });
    it("returns 409 for a duplicate email (both Supabase behaviours)", async () => {
        useFake({ auth: { signUp: async () => ({ data: { user: null, session: null }, error: { code: "user_already_exists", status: 422, name: "AuthApiError", message: "exists" } }) } });
        expect((await register(req("/api/auth/register", { method: "POST", body: validRegistration }))).status).toBe(409);
        resetRateLimits();
        useFake({ auth: { signUp: async () => ({ data: { user: { id: "x", identities: [] }, session: null }, error: null }) } });
        expect((await register(req("/api/auth/register", { method: "POST", body: validRegistration }))).status).toBe(409);
    });
});
describe("POST /api/auth/login", () => {
    it("returns 401 INVALID_CREDENTIALS without revealing which part was wrong", async () => {
        useFake({ auth: { signInWithPassword: async () => ({ data: {}, error: { code: "invalid_credentials", status: 400, name: "AuthApiError", message: "Invalid login credentials" } }) } });
        const res = await login(req("/api/auth/login", { method: "POST", body: { email: "a@b.co", password: "wrong" } }));
        expect(res.status).toBe(401);
        expect((await res.json()).error.code).toBe("INVALID_CREDENTIALS");
    });
    it("validates the body before calling Supabase (400)", async () => {
        const res = await login(req("/api/auth/login", { method: "POST", body: { email: "nope" } }));
        expect(res.status).toBe(400);
    });
    it("rate-limits repeated attempts from one IP (429 + Retry-After)", async () => {
        useFake({ auth: { signInWithPassword: async () => ({ data: {}, error: { code: "invalid_credentials", status: 400, name: "AuthApiError", message: "x" } }) } });
        const attempt = () => login(req("/api/auth/login", { method: "POST", body: { email: "a@b.co", password: "x" }, headers: { "x-forwarded-for": "203.0.113.9" } }));
        for (let i = 0; i < 10; i++)
            expect((await attempt()).status).toBe(401);
        const blocked = await attempt();
        expect(blocked.status).toBe(429);
        expect(blocked.headers.get("retry-after")).toBeTruthy();
        expect((await blocked.json()).error.code).toBe("RATE_LIMITED");
    });
});
describe("GET /api/auth/me and POST /api/auth/logout", () => {
    it("me returns 401 when signed out", async () => {
        const res = await me(req("/api/auth/me"));
        expect(res.status).toBe(401);
        expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    });
    it("me returns 401 SESSION_EXPIRED when the token is rejected", async () => {
        useFake({ authError: { name: "AuthApiError", message: "invalid JWT" } });
        const res = await me(req("/api/auth/me"));
        expect(res.status).toBe(401);
        expect((await res.json()).error.code).toBe("SESSION_EXPIRED");
    });
    it("me returns 503 when the auth service is unreachable", async () => {
        useFake({ authError: { name: "AuthRetryableFetchError", message: "fetch failed" } });
        expect((await me(req("/api/auth/me"))).status).toBe(503);
    });
    it("me returns the profile of the signed-in user only", async () => {
        useFake({
            user: USER_A,
            tables: { profiles: { data: { id: USER_A.id, full_name: "Alice Test", email: "alice@example.test", created_at: "2026-10-01T00:00:00Z" }, error: null } },
        });
        const res = await me(req("/api/auth/me"));
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.data.user).toMatchObject({ id: USER_A.id, fullName: "Alice Test", email: "alice@example.test" });
        expect(JSON.stringify(json)).not.toMatch(/password/i);
    });
    it("logout succeeds even when signed out", async () => {
        const res = await logout(req("/api/auth/logout", { method: "POST" }));
        expect(res.status).toBe(200);
    });
});
