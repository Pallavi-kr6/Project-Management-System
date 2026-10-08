# Code walkthrough

For each major file: **what / why / key points / what an interviewer may ask**. Paths are relative to the repo root.

---

## 1. Database

### `supabase/schema.sql`
* **What:** tables (`profiles`, `projects`, `tasks`), CHECK constraints, indexes, triggers, the `projects_with_stats` view, `get_dashboard_stats()`, RLS policies, grants.
* **Why:** one idempotent script an evaluator can paste into the Supabase SQL editor.
* **Key points:** FKs with `ON DELETE CASCADE`; `(select auth.uid())` wrapping for performance; `security_invoker = true` on the view; `SECURITY DEFINER` trigger with `search_path = ''`; `anon` privileges revoked.
* **Likely questions:** *Why does a view need `security_invoker`?* (otherwise it runs as owner and bypasses RLS.) *Why `search_path = ''` in a SECURITY DEFINER function?* (prevents search-path hijacking.) *Why is there no INSERT policy on profiles?* (the trigger creates rows; users can't forge profiles.)

### `tests/sql/rls.test.sql`, `tests/sql/supabase_stub.sql`, `scripts/test-rls.sh`
* **What:** a stub of Supabase's roles + `auth.uid()` so the schema runs on plain PostgreSQL, and 32 assertions executed as users A, B and `anon`.
* **Why:** RLS is security-critical, so it is tested like code, not assumed.
* **Ask:** *How do you test authorization?* → switch role + set `request.jwt.claims`, assert 0 rows / policy violations.

---

## 2. Supabase clients and session

### `src/lib/supabase/server.js` — `createClient()`
Per-request server client built with `createServerClient(url, anonKey, { cookies })`, reading/writing the request's cookies. Uses the **anon key + user JWT**, so RLS applies. Cookie writes go through `hardenCookieOptions`.
*Ask:* *Why not the service-role key?* It bypasses RLS; one bug would expose all tenants. *Why per-request?* Cookies differ per request; sharing a client would mix users.

### `src/lib/supabase/cookies.js` — `hardenCookieOptions`
Forces `HttpOnly`, `SameSite=Lax`, `Secure` in production. The library's default is JS-readable cookies; we have no browser client so we lock them down.
*Ask:* *Where is the JWT stored?* In an HttpOnly cookie, not localStorage → XSS can't read it. *CSRF?* `SameSite=Lax` + JSON content-type requirement.

### `src/lib/supabase/middleware.js` + `src/middleware.js`
Runs for page routes (matcher excludes `/api`): builds a Supabase client on the request, calls `auth.getUser()` (refreshing tokens and updating cookies), redirects signed-out users from protected prefixes to `/login?next=…`, and signed-in users away from `/login` and `/register`.
*Ask:* *Why `getUser()` and not `getSession()`?* `getSession()` only decodes the cookie; `getUser()` validates with the Auth server. *Why not protect APIs here?* They return JSON 401, not redirects, and authenticate themselves (also avoids a duplicate network call).

### `src/lib/supabase/env.js`
Reads only the two public variables; throws `CONFIG_ERROR` if missing. Deliberately has no service-role accessor.

---

## 3. API infrastructure

### `src/lib/api/handler.js` — `publicRoute`, `withAuth`, `withAuthParams`
Higher-order functions that wrap every route: create the Supabase client, authenticate, `try/catch` into `handleError`, and log `{method, path, status, ms}` as JSON.
* `authenticate()` maps: retryable network failure → `503`, other auth error → `401 SESSION_EXPIRED`, no user → `401 UNAUTHORIZED`.
* Split into `withAuth` / `withAuthParams` because Next.js type-checks the second argument of route exports.
*Ask:* *Is this "middleware"?* It is the function-composition equivalent of Express middleware: cross-cutting concerns (auth, errors, logging) in one place rather than copy-pasted per route.

### `src/lib/api/parse.js`
`parseBody`, `parseQuery`, `parseId`, `parseWith`. Enforces `application/json` (415), catches malformed JSON (400), converts Zod issues to `{field,message}[]`, treats empty query values as absent.

### `src/lib/api/response.js` and `errors.js`
`ok()`, `fail()`, `handleError()`, `buildMeta()`, `ApiError`. One envelope, stable error codes. Unknown errors → generic `500` and a structured server log.
*Ask:* *Why not return the DB error?* It leaks schema/internal details helpful to attackers.

### `src/lib/api/auth-errors.js`
Maps Supabase Auth error codes to our codes/messages. `invalid_credentials` has one message for both wrong email and wrong password (no account enumeration at login).

### `src/lib/rate-limit.js`
Fixed-window in-memory counter keyed `action:ip`; `enforceRateLimit` throws `429` + `Retry-After`. Limit: 10 logins / 15 min, 5 registrations / hour.
*Ask:* *Weakness?* Per-instance memory, and `x-forwarded-for` trust → use Redis/Upstash and the platform's trusted IP header in production.

---

## 4. Validation

### `src/validations/*.js`
* `common.js`: `uuidSchema` (regex), `isoDateSchema` (format **and** real calendar date: rejects `2026-02-31`), `requiredText`, `hasAtLeastOneField`.
* `auth.js`: email (trim, lower-case, ≤254), password (8–72, letter + number; 72 = bcrypt byte limit). Login does **not** apply strength rules (don't lock out old passwords).
* `project.js` / `task.js`: create schemas (required fields), update schemas (all optional + "at least one field" + date order), list-query schemas with defaults, whitelisted `sort`.
* The same schemas are imported by the React forms → **shared validation**.
*Ask:* *Why no `.default()` in update schemas?* A default would silently overwrite existing values on partial updates (an easy bug).

---

## 5. Data access

### `src/lib/db/projects.js`, `tasks.js`, `dashboard.js`
Thin functions taking a Supabase client: `listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`, task equivalents, `getDashboard`.
* Reads go through `projects_with_stats` for task counts.
* Filters use builder methods (`.eq`, `.ilike`) → **parameterised**, no string-built SQL. `escapeLike` makes `%`/`_` literal. Sort keys come from a whitelist map.
* `owner_id` always from the session user; updates/deletes use `.select().maybeSingle()` and treat `null` as 404.
* `createTask`/`updateTask` call `assertProjectAccessible` first, so a wrong project id yields `PROJECT_NOT_FOUND` rather than a confusing RLS error.
*Ask:* *How do you prevent IDOR?* → RLS + 404 on no-row; id never trusted. *SQL injection?* → no concatenated SQL; values travel as parameters / URL-encoded filters; enum/sort whitelists; UUID validation.

### `src/lib/db/errors.js` — `dbError`
Maps Postgres codes: `23514` → `400` (with `INVALID_DATE_RANGE` for our named constraint), `23503` → `404`, `22P02` → `400`, `42501` → `403`, network → `503`, otherwise generic `500`. Logs the raw message server-side only.

### `src/lib/db/mappers.js`
snake_case rows ↔ camelCase domain objects; `toProjectRow`/`toTaskRow` drop `undefined` keys so partial updates never null out columns.

### `src/lib/dashboard.js`
Pure `buildDashboardStats()`; normalises missing statuses to `0`, tolerates string counts. Isolated so it is unit-tested without a database. `lib/db/dashboard.js` fetches the RPC + upcoming tasks + recent projects in parallel (`Promise.all`).

---

## 6. Route handlers

`src/app/api/auth/{register,login,logout,me}/route.js`, `projects/route.js`, `projects/[id]/route.js`, `tasks/route.js`, `tasks/[id]/route.js`, `dashboard/route.js`.
Each is ~10–25 lines: wrapper → parse → db function → `ok()`. Registration also detects Supabase's "obfuscated duplicate" (user with empty `identities`) and returns `409`. `register` passes `emailRedirectTo` built from the **request origin**, so it works on any deployed domain.

---

## 7. Frontend

* `src/lib/api/client.js` — `apiRequest` (network errors, 401 redirect, typed errors), the `api` object, `fieldErrors`.
* `src/hooks/use-api.js` — SWR hooks, `revalidateData()`, retry policy (no retries on 4xx).
* `src/components/ui/*` — design-system primitives. `dialog.jsx` uses the native `<dialog>` element (focus trap, Esc, backdrop for free). `toast.jsx` is a tiny context with an `aria-live` region.
* `src/components/layout/app-shell.jsx` — responsive sidebar (off-canvas on < lg), top bar, theme toggle, sign-out.
* `src/components/tasks/tasks-panel.jsx` — search (debounced 350 ms) + status/priority/project filters + pagination + create/edit/delete; reused by `/tasks` and `/projects/[id]`.
* `src/components/tasks/task-item.jsx` — checkbox complete, inline status/priority selects, overdue highlight, per-row busy state.
* `src/app/(app)/dashboard/page.jsx` — cards, CSS distribution bars (no chart library; three categories don't need one), upcoming deadlines, recent projects, stale-data banner.
* `src/app/(auth)/login/login-form.jsx` — client validation with the shared schema, server error display, `next` redirect restricted by `safeNextPath` (open-redirect guard), full-page navigation after login.
*Ask:* *Why `window.location.assign` after login/logout instead of `router.push`?* A hard navigation guarantees fresh cookies are used and the in-memory SWR cache of the previous user is discarded.

---

## 8. Config & tooling

* `next.config.mjs` — security headers, `poweredByHeader: false`.
* `tailwind.config.js` + `globals.css` — design tokens as CSS variables (light/dark).
* `.github/workflows/ci.yml` — lint, test, build.
* `tests/*.test.js` — unit/route tests with `tests/helpers/fake-supabase.js` (a recording, chainable stand-in for the query builder); `tests/integration/*.itest.js` — real PostgREST.
