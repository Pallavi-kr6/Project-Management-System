# Architecture

## System diagram

```
Browser
   |   React UI (client components) + SWR cache
   |   fetch("/api/...")   same origin, session cookie (HttpOnly) attached automatically
   v
Next.js Web App  (Vercel / Node)
   |
   |-- middleware.js ..... for PAGE requests: refresh session, redirect signed-out users to /login
   |
   v
API Route Handlers  (src/app/api/**/route.js)
   |   withAuth():   verify session (supabase.auth.getUser) -> 401 if none
   |   parseBody()/parseQuery()/parseId():  Zod validation -> 400 if invalid
   |   lib/db/*:     data-access functions (parameterised PostgREST queries)
   |   ok() / handleError():  one JSON envelope, safe error mapping
   v
Supabase
   |
   +--> Supabase Auth ........ sign-up/sign-in, bcrypt password hashes, issues JWTs
   |
   +--> PostgreSQL ........... profiles / projects / tasks (+ view, function, triggers)
   |
   +--> Row Level Security ... policies evaluated for every statement using the caller's JWT
```

The browser **never** talks to Supabase. Only the server does, and only with the anon key plus the user's own JWT.

## Request lifecycle (example: `PUT /api/tasks/{id}` with `{ "status": "Completed" }`)

1. Browser sends the request with the session cookie.
2. `withAuthParams` creates a per-request Supabase client from the cookies and calls `auth.getUser()`, which asks Supabase Auth to verify the token. No user → `401`.
3. `parseId` checks the path id is a UUID (`400 INVALID_ID`); `parseBody(updateTaskSchema)` checks content type, JSON, enum values, dates, "at least one field" (`400 VALIDATION_ERROR`).
4. `updateTask()` runs `UPDATE tasks SET status = $1 WHERE id = $2 RETURNING …` through PostgREST **as the user**.
5. PostgreSQL applies RLS: the row is updated only if its project belongs to the user. Zero rows → `404 TASK_NOT_FOUND`.
6. The handler returns `{ success: true, data: task }`; SWR refreshes the affected views.

## Why these technologies

**Next.js.** One JavaScript codebase for UI and API; file-system routing, middleware, and zero-config Vercel deploys. Route Handlers give us real REST endpoints, which the assignment evaluates, without a second server to host. *Trade-off:* the API is coupled to the web deployment; a separate Express/NestJS service scales and versions independently.

**Supabase.** Managed PostgreSQL + a battle-tested Auth service (bcrypt hashing, token issuing/refresh, email confirmation, rate limits). That removes the highest-risk code to write by hand (password storage and session handling) and means the evaluator needs only Node and project credentials. *Trade-off:* vendor coupling for Auth; data itself is plain Postgres and portable.

**PostgreSQL.** The domain is relational (users → projects → tasks) and needs foreign keys, constraints, transactions, aggregates and joins. PostgreSQL adds Row Level Security, partial indexes, trigram search and JSON functions.

**Row Level Security.** Authorization is enforced *inside the database*, next to the data. If a developer forgets an ownership check in an endpoint, the database still refuses to return or change another user's rows. It makes "the whole app is multi-tenant safe" a property of the schema rather than of every query.

**REST API (rather than calling Supabase from the browser).** Explicit endpoints are testable with curl, documentable, evaluable, reusable by a future mobile client, and give one place to validate input, rate-limit, log and shape errors.

**Server-side validation (and client-side too).** Frontend validation is a UX nicety: anyone can call `/api/*` with curl. The same Zod schemas run in the browser (instant feedback) and on the server (the real gate).

## Authentication

* Supabase Auth owns credentials. `register`/`login` routes call `signUp` / `signInWithPassword` on the server.
* `@supabase/ssr` stores the session in cookies. We force **HttpOnly**, `SameSite=Lax` and `Secure` (production) because no browser-side Supabase client exists.
* **Session maintenance:** the access JWT is short-lived (Supabase default 1 hour); the refresh token (in the same cookie) renews it. `middleware.js` calls `getUser()` on page requests and writes refreshed cookies; API routes also refresh when needed.
* **Expiry:** if refresh fails, `getUser()` errors → API returns `401 SESSION_EXPIRED` → the client wrapper redirects to `/login?reason=expired` and the login page shows "Your session has expired".
* `getUser()` (verified with Supabase) is used for every security decision; `getSession()` (just decodes the cookie) is not trusted.

## Authorization and data ownership

| Layer | Mechanism |
|---|---|
| Identity | `user.id` from the verified session. Never from the request |
| Create | `owner_id` set by the server; RLS `WITH CHECK` rejects any other value |
| Read/update/delete | RLS `USING (owner_id = auth.uid())`; tasks via `EXISTS` on the parent project |
| Cross-resource | Task create/update first checks the target project is visible to the user |
| Information hiding | Other users' ids → `404`, identical to "does not exist" |
| Views/functions | `security_invoker`, so they cannot become an RLS bypass |
| Service role | Not used at all, so there is no code path that bypasses RLS |

## Frontend architecture

* **App Router with two route groups:** `(auth)` for public pages, `(app)` for pages inside the shared sidebar shell. Page access is gated by `middleware.js`.
* **Server state with SWR.** Hooks in `hooks/use-api.js` (`useProjects`, `useTasks`, `useDashboard`, `useProject`, `useCurrentUser`). After any write `revalidateData()` clears stale caches and refetches mounted views; mounted views keep previous data while refetching (no flicker).
* **One fetch wrapper** (`lib/api/client.js`) converts network failures to `NETWORK_ERROR`, 401s to a redirect, and error envelopes to typed `ApiClientError`s with per-field messages for forms.
* **Components:** small primitives in `components/ui`, feature components per domain, `TasksPanel` shared by the Tasks page and the project page.
* **UX states everywhere:** skeletons while loading, empty states, error states with *Try again*, an amber "couldn't refresh" banner when stale data is shown, disabled/spinner buttons during requests (always reset in `finally`).

## Error handling strategy

* Server: everything thrown inside a handler is caught by one wrapper → `handleError`. Known failures are `ApiError`s with stable codes; anything else becomes `500 INTERNAL_ERROR` with a generic message while the real error is logged as JSON. Postgres error codes (`23514`, `23503`, `22P02`, `42501`, …) are mapped by `lib/db/errors.js`.
* Client: errors surface as toasts (actions), inline field errors (forms), or error/empty states (page loads).

## Deployment architecture

```
GitHub  --push-->  Vercel (build: next build)  --HTTPS-->  Users
                       |
                       +--> Supabase project (Auth + Postgres), URL + anon key in Vercel env vars
```
Two public environment variables, no secrets. Supabase *Site URL / Redirect URLs* must contain the production URL.

## Scaling notes (see the interview docs for more)

Stateless Next.js instances scale horizontally; Postgres is the stateful part (indexes, connection pooling through Supabase's PostgREST/pgbouncer, read replicas). The in-memory rate limiter should move to Redis when running several instances.
