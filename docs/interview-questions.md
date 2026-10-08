# Interview preparation — specific to this repository

Every answer below is written against what this code **actually does**. Where the honest answer is "that is a limitation", it says so — interviewers reward candidates who know their project's weak points.

**How to use:** read the *Strong interview answer* aloud, make sure you can explain *why it is correct*, then practise the follow-up. Section numbers follow the requested outline; the 34 "difficult questions" are marked ⭐ and distributed in the sections they belong to.

**Scope reminder:** this is the **web-only** implementation. If asked about the mobile app: *"The brief asks for web + mobile; for this submission I deliberately scoped to the web app. The backend is a plain REST API so a mobile client could reuse it — it would need Bearer-token auth instead of cookies."* (See the CORS question in section 13.)

Contents: 1 Overview · 2 Architecture · 3 Next.js · 4 React · 5 JavaScript · 6 Supabase · 7 PostgreSQL · 8 Database design · 9 Authentication · 10 Authorization · 11 RLS · 12 REST APIs · 13 API security · 14 Validation · 15 Error handling · 16 State management · 17 Search & filtering · 18 Performance · 19 Testing · 20 Deployment · 21 Git/GitHub · 22 Security · 23 Scalability · 24 Design decisions · 25 Trade-offs · 26 Debugging · 27 Future improvements

---

## 1. Project overview

**Question:** Walk me through your project in two minutes.

**Strong interview answer:** It's an authenticated, multi-tenant project and task manager. Users register and log in with Supabase Auth, create projects, add tasks with priority, status and due date, and see a dashboard of live statistics. It's Next.js 15 with JavaScript; the UI calls my own REST-style route handlers under `/api`, which authenticate the session, validate input with Zod, and query Supabase PostgreSQL as the signed-in user. Row Level Security enforces that users can only touch their own projects and tasks, so isolation holds at the database level, not just in my code. It has search, filters, pagination, a responsive layout with dark mode, and tests at three levels: unit/route tests, SQL tests for RLS, and integration tests through PostgREST.

**Why this answer is correct:** It states the problem, the stack, the request path and — crucially — the security model, in the order an interviewer cares about, and only claims what exists.

**Possible follow-up:** What was the hardest part?

**Ideal follow-up answer:** Getting authorization right in layers: making sure views and functions respect RLS (`security_invoker`), preventing IDOR by returning 404 for foreign ids, and making sure tasks can't be moved into another user's project. I wrote SQL tests that run as two users to prove it instead of trusting my reading of the policies.

---

**Question:** What is the original assignment and what did you leave out?

**Strong interview answer:** The brief asks for web plus a mobile app on the same backend. I scoped this submission to the web app only. Everything else — auth, projects, tasks, dashboard, search/filter, the listed endpoints, validation, authorization, rate limiting on auth endpoints, docs — is implemented. The one deliberate substitution is the backend technology: the brief names Express/NestJS; I used Next.js route handlers on Supabase.

**Why this answer is correct:** It's honest about scope and flags the stack deviation openly instead of hoping it isn't noticed.

**Possible follow-up:** Isn't that a deviation from the requirements?

**Ideal follow-up answer:** Yes, and I'd say so up front. The architecture requirements — REST routes, middleware-style authentication, validation, error handling, logging, RLS/authorization, parameterised queries — are all met; Next route handlers with wrapper functions play the role of Express routes plus middleware. If a separate service were mandatory I'd move `lib/api` and `lib/db` into Express with minimal change, since they don't depend on React.

---

## 2. Architecture

**Question:** Describe the architecture and the path of a request.

**Strong interview answer:** Browser → Next.js app → route handlers → Supabase. For a task update: the browser sends a same-origin `PUT /api/tasks/:id` with the HttpOnly session cookie. `withAuthParams` builds a Supabase client from the cookies and calls `auth.getUser()`, which Supabase verifies; no user means 401. Then `parseId` and `parseBody` validate with Zod; `updateTask` runs the update through PostgREST with the user's JWT, so PostgreSQL applies RLS. No row updated means 404. The handler returns the standard `{success, data}` envelope and the UI revalidates its SWR caches.

**Why this answer is correct:** It follows the real code path (`handler.js` → `parse.js` → `db/tasks.js`) and shows where each security control sits.

**Possible follow-up:** Why doesn't the browser call Supabase directly?

**Ideal follow-up answer:** It could — Supabase is designed for that with RLS — but then validation, rate limiting, logging, and error shaping would be scattered across clients, the REST API the brief wants wouldn't exist, and a future mobile app couldn't reuse my business rules. Going through my API keeps one enforced surface, and the browser never needs a Supabase client or token access at all, which lets me make the cookies HttpOnly.

---

**Question ⭐:** Why Supabase instead of a traditional Express + PostgreSQL backend?

**Strong interview answer:** For this scope Supabase removes the riskiest, least differentiating code: password hashing, token issuing and refresh, email confirmation and auth rate limits — while still giving me a real PostgreSQL database with RLS. The evaluator also doesn't need to install or host Postgres. The trade-off is vendor coupling for Auth and less control over infrastructure. Because my data access is isolated in `src/lib/db` and the data is plain Postgres, the lock-in is limited.

**Why this answer is correct:** It gives a concrete reason tied to the requirements and an honest cost, then shows how the coupling is contained.

**Possible follow-up:** When would Express + Postgres be the better choice?

**Ideal follow-up answer:** When I need custom auth flows, background workers and queues, complex multi-step transactions, non-HTTP protocols, strict data-residency/on-prem hosting, or a team already operating that stack. Business logic that must live in one transaction is easier in a server that talks SQL directly than through PostgREST.

---

**Question ⭐:** Why Next.js API routes (route handlers)?

**Strong interview answer:** One repo, one deployment, one language and shared types and Zod schemas between UI and API. Route handlers are real HTTP endpoints, so I get a REST API that curl, tests and a future mobile client can call. They deploy as serverless functions on Vercel with zero config. The cost is coupling the API's release and scaling to the web app, and serverless constraints like per-instance memory (which affects my in-memory rate limiter).

**Why this answer is correct:** Correctly identifies benefits (shared code, simplicity) and the real limitations that show up in this repo.

**Possible follow-up:** Would you keep it this way for a large team?

**Ideal follow-up answer:** Probably split the API into its own service (NestJS/Express or a separate Next/Node app) once there are multiple clients, a separate team, or different scaling profile. My layering (`lib/api`, `lib/db`, `validations`) is framework-light on purpose so that move is mostly relocating files.

---

**Question ⭐:** Why not Firebase?

**Strong interview answer:** The data is relational — users own projects that own tasks — and I need foreign keys, constraints, joins and aggregates. Firestore is a document store where I'd have to denormalise and enforce relationships and counts in application code, and authorization is written in a separate rules language. PostgreSQL gives constraints and RLS in SQL, and the brief requires PostgreSQL or MySQL. Firebase is also explicitly outside the request.

**Why this answer is correct:** The deciding factor is the data model, not preference.

**Possible follow-up:** What does Firebase do better?

**Ideal follow-up answer:** Offline-first sync, realtime listeners with minimal setup, and very simple scaling for read-heavy document access. For a collaborative offline-first mobile app it could be attractive. Supabase also has realtime if I need it.

---

## 3. Next.js

**Question:** What App Router features did you use and why?

**Strong interview answer:** Route groups `(auth)` and `(app)` give different layouts without changing URLs: public pages vs the sidebar shell. Dynamic segments `projects/[id]` and API `[id]` routes. `middleware.js` for page protection and session refresh. Route handlers for the API. `layout.jsx`, `error.jsx` and `not-found.jsx` for global shells and fallbacks. The interactive pages are client components because they use hooks; layouts and static shells stay server components.

**Why this answer is correct:** All of those are in the repo and each use is justified by a need.

**Possible follow-up:** Why are your pages client components instead of server components?

**Ideal follow-up answer:** The data is per-user, behind auth, and highly interactive (filters, optimistic UI states, dialogs). Server components would need me to forward the cookie on every fetch and re-render on every filter change. I chose client components with SWR for responsive interactions; the trade-off is no server-rendered HTML for those pages and an extra round trip after hydration. A hybrid — server-render the first dashboard payload — is an improvement I'd consider.

---

**Question:** What changed with `params` and `cookies()` in Next 15, and how did you handle it?

**Strong interview answer:** In Next 15 dynamic route `params` are a Promise, and `cookies()` is async. My wrapper `withAuthParams` awaits `context.params` once, and `createClient()` does `await cookies()`. Next's build also type-checks the second argument of route exports, which is why I have two wrappers: `withAuth` (no params) and `withAuthParams<P>`.

**Why this answer is correct:** Reflects real Next 15 behaviour and an actual build error I hit and fixed.

**Possible follow-up:** Why is `useSearchParams` wrapped in `<Suspense>` on the login page?

**Ideal follow-up answer:** In a statically prerendered page, reading search params forces client-side rendering for that subtree; Next requires a Suspense boundary so the rest of the page can still be prerendered, otherwise the build fails.

---

**Question:** What does your middleware do and why does it exclude `/api`?

**Strong interview answer:** For page requests it refreshes the Supabase session cookies and redirects signed-out users from protected prefixes to `/login?next=…`, and signed-in users away from the auth pages. API routes are excluded because they must answer with JSON 401, not an HTML redirect, and they already authenticate themselves — also avoids a second `getUser()` network call per API request.

**Why this answer is correct:** Matches `src/middleware.js` matcher and `lib/supabase/middleware.js`.

**Possible follow-up:** Is middleware alone enough to protect the data?

**Ideal follow-up answer:** No — middleware only protects pages, and it can be bypassed by calling the API directly. The real protection is `withAuth` on every route plus RLS in the database. Middleware is for user experience (redirects) and token refresh.

---

## 4. React

**Question:** Explain how your search input works and why you debounce.

**Strong interview answer:** The input is controlled; its value lives in state. A `useDebounce` hook returns the value after 350 ms of no typing, and that debounced value is part of the SWR key and the request params. So typing "website" fires one request, not seven, and each distinct filter combination has its own cache entry. I also reset to page 1 whenever a filter changes.

**Why this answer is correct:** It describes `use-debounce.js` and `tasks-panel.jsx` exactly and explains the cost saved.

**Possible follow-up:** What goes wrong without cleanup in the debounce effect?

**Ideal follow-up answer:** Without `clearTimeout` in the effect cleanup, older timers would still fire, applying stale values out of order and causing extra renders; and a timer could fire after unmount. The cleanup cancels the previous timer on each change.

---

**Question:** Why does `TaskForm` live inside `Dialog` children rather than being always mounted?

**Strong interview answer:** My `Dialog` renders its content only while open. That means each time it opens, the form component mounts fresh with initial state from props — no stale values from the last use, and its `useProjects` hook only fetches when the dialog is actually used.

**Why this answer is correct:** Accurate to `dialog.jsx` (`{open && …}`) and shows understanding of mount/unmount lifecycle as a state reset.

**Possible follow-up:** How is accessibility handled in the dialog?

**Ideal follow-up answer:** It uses the native `<dialog>` with `showModal()`, so the browser handles focus trapping, inert background, Escape to close and a backdrop. I add `aria-labelledby`, a labelled close button, and prevent closing while a delete is in flight.

---

**Question:** Why is the task checkbox only updated after the server responds instead of optimistically?

**Strong interview answer:** It's a deliberate simplicity choice: the checkbox is controlled by server data, so it flips after the PUT succeeds and SWR refetches; while the request is pending the row is disabled and dimmed. That avoids rollback logic and can never show a state the server rejected. The cost is a short delay on slow networks.

**Why this answer is correct:** Describes the real behaviour (which I also saw when Playwright's `check()` complained that the state hadn't changed immediately).

**Possible follow-up:** How would you make it optimistic?

**Ideal follow-up answer:** Use SWR's `mutate` with `optimisticData` and `rollbackOnError`: update the cached task immediately, send the PUT, roll back and toast on failure, and revalidate on settle.

---

## 5. JavaScript

**Question:** How do you keep data valid between the database, API and UI?

**Strong interview answer:** Zod schemas validate form input and API request bodies at runtime. Database rows are mapped from snake_case into the application's camelCase objects in `lib/db/mappers.js`, and API errors are checked with `instanceof` before the UI reads their messages or codes. The app uses JavaScript and JSX, so it does not rely on compile-time type checking.

**Why this answer is correct:** It describes the runtime validation and mapping that remain in the JavaScript project.

**Possible follow-up:** How are unexpected errors handled?

**Ideal follow-up answer:** API handlers convert unknown failures to a generic `500 INTERNAL_ERROR` response and log the actual error server-side. Client and form code check known error classes and show a safe fallback message for anything else.

---

## 6. Supabase

**Question ⭐:** How does Supabase Auth work in your app?

**Strong interview answer:** On register/login my route handler calls `signUp` or `signInWithPassword` on the server. Supabase verifies or creates the user — storing a bcrypt hash in `auth.users` — and returns a session: a short-lived JWT access token and a refresh token. `@supabase/ssr` writes that session into cookies via my cookie adapter. On later requests the server rebuilds the client from those cookies and calls `getUser()`, which verifies the token with the Auth server and refreshes it if expired. The JWT's `sub` claim becomes `auth.uid()` inside PostgreSQL for RLS.

**Why this answer is correct:** It traces the actual flow end to end, including the link from JWT to RLS.

**Possible follow-up:** What's in the JWT and who signs it?

**Ideal follow-up answer:** Claims such as `sub` (user id), `role` (`authenticated`), `aud`, `exp`, and email. Supabase signs it with the project's JWT secret; PostgREST verifies the signature and sets the DB role and the `request.jwt.claims` setting that `auth.uid()` reads.

---

**Question ⭐:** Why should the `service_role` key never be exposed?

**Strong interview answer:** It maps to a role with `BYPASSRLS`: anyone holding it can read, modify and delete every row in every table, ignoring all policies. If it's in client code, env vars prefixed `NEXT_PUBLIC_`, a repo, or logs, the whole database is effectively public. My app doesn't use it at all — every query runs as the user with the anon key — so there is no code path that can bypass RLS, and `.env.example` documents it as "not required".

**Why this answer is correct:** States the mechanism (bypass RLS), the leak vectors, and what this project does instead.

**Possible follow-up:** When is service_role legitimately needed?

**Ideal follow-up answer:** Trusted server-only jobs: migrations, admin tooling, cron/webhook handlers acting across users, bulk imports. Keep it in server-side secrets only, scope its use to small well-reviewed functions, and rotate it immediately if exposed.

---

**Question:** What is the difference between the anon key and the service-role key, and is the anon key a secret?

**Strong interview answer:** The anon (publishable) key identifies the project and lets a request run as the `anon` role or, with a user JWT, as `authenticated`. It's designed to be public — anyone can see it in the network tab — and is safe only because RLS decides what each role may do. The service-role key is a secret that bypasses RLS.

**Why this answer is correct:** It separates identification from authorization, which is the core of Supabase's security model.

**Possible follow-up:** So what protects the data if the anon key is public?

**Ideal follow-up answer:** Table privileges plus RLS policies. I revoked all privileges from `anon`, enabled RLS on every table, and only granted `authenticated` access through ownership-based policies.

---

## 7. PostgreSQL

**Question ⭐:** Why UUIDs for primary keys?

**Strong interview answer:** They're unguessable, so ids in URLs don't reveal counts or let people enumerate records (`/projects/1`, `/projects/2`); they can be generated without a central sequence, which helps with distributed writes, imports and merging; and they match Supabase's `auth.users.id` type. Costs: 16 bytes vs 4/8, larger indexes, and random v4 UUIDs hurt index locality compared with sequential ids (UUIDv7/ULID can fix that).

**Why this answer is correct:** Gives both benefits and costs; also clarifies that UUIDs are defence in depth, not authorization — RLS still protects rows.

**Possible follow-up:** Does using UUIDs prevent IDOR?

**Ideal follow-up answer:** No. Unguessable ids only make probing harder; if an id leaks, access control must still say no. That's why every query is RLS-scoped and foreign ids return 404.

---

**Question ⭐:** Why foreign keys?

**Strong interview answer:** They make the database enforce referential integrity: a task can't point to a missing project, a project can't have a missing owner, and `ON DELETE CASCADE` deletes a project's tasks atomically instead of my code looping and risking orphans. They also document the model and let the planner reason about joins. I also index the FK columns, since PostgreSQL doesn't do that automatically and cascades/joins need it.

**Why this answer is correct:** Accurate: FKs don't auto-index in PostgreSQL; the schema indexes `tasks.project_id` (composite) and `projects.owner_id`.

**Possible follow-up:** What does cascade cost on a project with 100k tasks?

**Ideal follow-up answer:** A large single-transaction delete: locks, WAL volume and time. For huge projects I'd soft-delete (set `deleted_at`) and purge in batches in a background job.

---

**Question:** Explain CHECK constraints vs ENUM types and why you chose CHECKs.

**Strong interview answer:** Both restrict values. Enums are a separate type, compact, and self-describing, but adding or reordering values needs `ALTER TYPE` and complicates idempotent scripts. CHECK constraints on `text` are changed with a normal `ALTER TABLE`, and my `schema.sql` can be re-run safely. The database still enforces allowed values even if the API validation were bypassed.

**Why this answer is correct:** Matches the schema and gives the real motivation (idempotent script, easy evolution).

**Possible follow-up:** What happens if you need to add a status "Blocked"?

**Ideal follow-up answer:** Update the CHECK constraint in a migration (drop/add), update the shared `constants.js` and Zod enum, the badge colours, and the dashboard distribution function/mappers; deploy DB change first so old code remains valid.

---

**Question:** What does `(select auth.uid())` do in your policies?

**Strong interview answer:** Wrapping the function in a scalar subquery lets PostgreSQL evaluate it once per statement as an initplan and reuse the result, instead of re-evaluating it for each row. For large tables that's a measurable speedup; semantics are identical.

**Why this answer is correct:** This is Supabase's recommended RLS performance pattern, applied throughout `schema.sql`.

**Possible follow-up:** How would you check a policy's performance?

**Ideal follow-up answer:** Run `EXPLAIN (ANALYZE, BUFFERS)` with the role/claims set (`set local role authenticated; set request.jwt.claims…`), verify index use on `owner_id`/`project_id`, and look for per-row subplans.

---

## 8. Database design

**Question ⭐:** Why are projects and tasks separate tables?

**Strong interview answer:** It's a one-to-many relationship. Putting tasks inside a project row (array/JSON) would make filtering, sorting, counting, updating one task, indexing and enforcing constraints per task awkward or impossible; and a project row would grow unbounded. Separate tables normalise the data (3NF), let each task have its own lifecycle and constraints, and let me query tasks across projects (the Tasks page, dashboard).

**Why this answer is correct:** Gives data-modelling reasons directly tied to features in this app.

**Possible follow-up:** Why doesn't `tasks` have an `owner_id`?

**Ideal follow-up answer:** It'd duplicate ownership and could drift from the project's owner; one source of truth is `projects.owner_id`. RLS derives task access through an `EXISTS` on the parent project. The trade-off is a join per task access; if it became a bottleneck I'd denormalise `owner_id` with a trigger or composite FK guaranteeing consistency.

---

**Question:** Why a `profiles` table when `auth.users` exists?

**Strong interview answer:** The `auth` schema is managed by Supabase and not something the app should read or alter; a public `profiles` table holds app-level fields (full name, email copy), can be referenced by foreign keys, and can have its own RLS. A `SECURITY DEFINER` trigger creates the row on sign-up, so the two stay in sync.

**Why this answer is correct:** Standard Supabase pattern, implemented in `handle_new_user()`.

**Possible follow-up:** What if the trigger fails?

**Ideal follow-up answer:** The `auth.users` insert would roll back, so sign-up fails rather than creating a user without a profile; that's why the function is small and defensive (`coalesce` full name with email prefix). I'd monitor sign-up errors.

---

**Question:** Why are task counts computed in a view instead of stored columns?

**Strong interview answer:** Stored counters can drift (missed update, failed trigger, concurrent changes) and need maintenance on every task write. Computing `count(*) filter (where status='Completed')` from the source of truth is always correct and cheap at this scale with the `(project_id, status)` index. The view is `security_invoker` so RLS still applies.

**Why this answer is correct:** Accurate trade-off: correctness vs read cost.

**Possible follow-up:** When would you switch to stored counts?

**Ideal follow-up answer:** When project lists with many large projects become slow: add counter columns maintained by triggers (or a materialised view refreshed periodically), accepting eventual consistency or extra write cost.

## 9. Authentication

**Question ⭐:** Where is the JWT stored, and how is the session maintained?

**Strong interview answer:** In cookies named like `sb-<project>-auth-token`, containing the access and refresh tokens. I set them server-side with `HttpOnly`, `SameSite=Lax` and `Secure` in production, so page JavaScript can't read them — which matters because an XSS bug could otherwise steal the tokens from localStorage. The browser attaches them automatically to same-origin requests. The access token is short-lived (Supabase default 1 hour); when it expires, `getUser()` uses the refresh token to get a new pair and my cookie adapter writes them back, so the session persists until logout or until the refresh token is revoked/expired.

**Why this answer is correct:** Matches `lib/supabase/cookies.js` and `server.js`; I verified on the wire that the `Set-Cookie` is `Secure; HttpOnly; SameSite=lax`.

**Possible follow-up:** Cookies vs localStorage — what are the trade-offs?

**Ideal follow-up answer:** localStorage is readable by any script on the page (XSS → token theft) and is not sent automatically; cookies can be HttpOnly but are sent automatically, which creates CSRF risk — mitigated with `SameSite=Lax`, JSON-only content type (a cross-site form can't send `application/json`), and no state-changing GETs. For a cookie session I'd add an Origin check or CSRF token if I wanted defence in depth.

---

**Question ⭐:** What happens when the token expires?

**Strong interview answer:** Three cases. Access token expired but refresh token valid: `getUser()` silently refreshes and rotates cookies; the user notices nothing. Refresh token invalid/revoked: Supabase returns an auth error, my `withAuth` answers `401 SESSION_EXPIRED`, the client wrapper redirects to `/login?reason=expired`, and the login page shows "Your session has expired". Page navigations are handled by middleware, which redirects to login with a `next` parameter so they return where they were after signing in. I tested the redirect path by clearing cookies in a browser run.

**Why this answer is correct:** Matches `handler.js`, `client.js` and `login-form.jsx`.

**Possible follow-up:** What if the auth service is down rather than the token expired?

**Ideal follow-up answer:** `getUser()` returns a retryable fetch error; I map it to `503 SERVICE_UNAVAILABLE` rather than 401, so users aren't logged out falsely — the UI shows an error state with retry and keeps already-loaded data on screen.

---

**Question:** How do you store and protect passwords?

**Strong interview answer:** I don't store them. They go from the register form to my API (HTTPS) to Supabase Auth, which hashes them with bcrypt into `auth.users`, a schema my app can't read. They're never logged, never in my tables, and never in any response — a test asserts the register response doesn't contain the password. I enforce a minimum of 8 characters with a letter and a number and a 72-char maximum because bcrypt only uses the first 72 bytes.

**Why this answer is correct:** Meets the brief's "never plain text" and explains the 72 limit.

**Possible follow-up:** Why don't you apply strength rules at login?

**Ideal follow-up answer:** Rules can change over time; if tightening them blocked login, existing users with older passwords would be locked out. Strength is checked when a password is set; login only checks it's non-empty.

---

**Question:** Does your login endpoint leak whether an email exists?

**Strong interview answer:** Login returns the same message for wrong email and wrong password. Registration, however, does return `409 EMAIL_ALREADY_EXISTS`, which does reveal that an address is registered — a usability-vs-enumeration trade-off most apps make. Mitigation is the registration rate limit; stricter apps send the same "check your email" response either way.

**Why this answer is correct:** Honest about the one place enumeration is possible.

**Possible follow-up:** How would you remove it?

**Ideal follow-up answer:** Always respond "if the address is new we sent a confirmation email", send a different email to existing users ("someone tried to register with your address"), and add CAPTCHA/rate limits.

---

## 10. Authorization

**Question ⭐:** What happens if someone modifies the frontend request?

**Strong interview answer:** Nothing they send is trusted. If they change a project id to another user's, RLS filters the row out and I return 404. If they add `owner_id` to a create body, my Zod schema doesn't include it, so it's stripped, and the server sets `owner_id` from the verified session — I tested that a forged value is ignored, and the database `WITH CHECK` would reject it anyway. If they send invalid enums or dates the server validation returns 400. If they remove the cookie they get 401. Frontend validation is only for UX.

**Why this answer is correct:** Covers tampering with ids, mass assignment, validation and auth, each with the exact control.

**Possible follow-up:** What is mass assignment and where could it bite here?

**Ideal follow-up answer:** Mass assignment is blindly writing client-supplied fields (like `owner_id`, `role`) into a record. It could bite if I did `insert(body)`; instead I whitelist via Zod and map fields explicitly in `toProjectRow`/`toTaskRow`.

---

**Question ⭐:** How do you prevent IDOR?

**Strong interview answer:** Insecure Direct Object Reference means accessing an object by changing its id. I never authorize based on "the id exists". Every query runs under RLS with the user's JWT, so only rows they own are visible/modifiable. For update/delete I use `.select().maybeSingle()`: no row returned → 404. I return 404 (not 403) for both "doesn't exist" and "not yours" so ids can't be probed. For tasks, access is derived from the parent project, and creating/moving a task first verifies the target project is visible. Tests: unit-level 404s, 32 SQL assertions, and integration tests with two users.

**Why this answer is correct:** Shows layered defence and exact code behaviour.

**Possible follow-up:** What if RLS were accidentally disabled on a table?

**Ideal follow-up answer:** App-level checks wouldn't catch it, because I deliberately rely on RLS. That's why `test:rls` is in the repo and part of review: any new table must enable RLS and have tests. I'd also add a CI query that fails if a `public` table has RLS disabled, and enable Supabase's security advisor.

---

**Question ⭐:** How would you add role-based access control?

**Strong interview answer:** Add collaboration tables: `project_members (project_id, user_id, role)` with roles like `owner | editor | viewer` (CHECK or enum). Rewrite policies to check membership: select if a member; insert/update tasks if role in (owner, editor); delete project only if owner. Wrap the membership lookup in a `security definer` helper function with a pinned `search_path` to avoid recursive policy evaluation. Optionally an org-level role in the JWT via a custom access-token hook. On the API side, return `403` when the user is a member but lacks the role, and 404 when not a member.

**Why this answer is correct:** RBAC in Postgres is naturally expressed as membership + policies; the answer addresses recursion and information hiding.

**Possible follow-up:** Why a helper function?

**Ideal follow-up answer:** A policy on `projects` that queries `project_members`, whose policy queries `projects`, can recurse infinitely. A `SECURITY DEFINER` function that bypasses RLS for the membership check breaks the cycle, and also centralises the logic so policies stay short.

---

## 11. Row Level Security

**Question ⭐:** What is Row Level Security?

**Strong interview answer:** A PostgreSQL feature where you attach policies to a table, and the database adds those predicates to every statement for non-exempt roles. `USING` filters which existing rows a query can see, update or delete; `WITH CHECK` validates new or changed rows on insert/update. Enabled with `ALTER TABLE … ENABLE ROW LEVEL SECURITY`; with no matching policy, access is denied by default. Superusers and roles with `BYPASSRLS` (like `service_role`) are exempt.

**Why this answer is correct:** Defines USING vs WITH CHECK, default deny, and the exemption that makes service_role dangerous.

**Possible follow-up:** What's the difference for UPDATE?

**Ideal follow-up answer:** `USING` decides which rows can be targeted (old row); `WITH CHECK` decides whether the resulting row is acceptable (new row). In `projects_update_own` both require `owner_id = auth.uid()`, so users can neither edit others' rows nor re-assign their own rows to someone else.

---

**Question ⭐:** How does RLS prevent one user from accessing another user's projects?

**Strong interview answer:** Each request reaches PostgreSQL with that user's JWT, so the role is `authenticated` and `auth.uid()` returns their id. The policy `owner_id = (select auth.uid())` is silently appended to every query: `SELECT * FROM projects` returns only their rows even without a WHERE clause; `UPDATE`/`DELETE` of someone else's id affect 0 rows; inserting with another `owner_id` raises a policy violation. Tasks use an `EXISTS` on their parent project owned by the caller. I verified this with 32 SQL assertions executed as two different users plus the `anon` role.

**Why this answer is correct:** Explains the mechanism, shows each CRUD outcome, and cites verification.

**Possible follow-up:** Can a view bypass RLS?

**Ideal follow-up answer:** Yes — by default views run with the view owner's privileges, so a view over RLS tables can leak rows. I create `projects_with_stats` with `security_invoker = true` (PostgreSQL 15+) so it runs as the caller, and `get_dashboard_stats()` is `SECURITY INVOKER` with an explicit owner filter as a second guard.

---

**Question:** Why 404 when RLS hides a row but 403 when a policy blocks an insert?

**Strong interview answer:** For reads/updates/deletes, RLS makes the row invisible, so from the query's perspective it just doesn't exist — "0 rows" — and I deliberately report the same 404 as for a missing id. For inserts, `WITH CHECK` failures raise an explicit error (SQLSTATE 42501), which I map to 403. In normal use the insert case is only reachable by a forged request, since the server sets the owner.

**Why this answer is correct:** Matches `db/errors.js` and the SQL tests.

**Possible follow-up:** Isn't 403 revealing?

**Ideal follow-up answer:** Slightly, but the only resource it could reveal is "that value isn't permitted" for data the caller supplied; no information about other users' objects is exposed. For id-based access I use 404.

---

## 12. REST APIs

**Question:** How did you design the REST API?

**Strong interview answer:** Resource-oriented: `/api/projects`, `/api/projects/{id}`, `/api/tasks`, `/api/tasks/{id}`, `/api/dashboard`, `/api/auth/*` as in the brief. Verbs map to methods: GET read, POST create (201), PUT update (partial updates, documented), DELETE (returns the id). A consistent envelope `{success, data, meta}` / `{success:false, error:{code,message,details}}`, correct status codes, pagination via `page`/`pageSize` with `meta`, whitelisted sorting, and filters as query params.

**Why this answer is correct:** Describes what's in `docs/api.md` and the implementation.

**Possible follow-up:** PUT vs PATCH — isn't partial update PATCH?

**Ideal follow-up answer:** Strictly, yes: PUT means full replacement and PATCH partial. The brief specifies `PUT`, so I implemented PUT with partial-update semantics and documented it. If I could change the contract I'd add PATCH and keep PUT for full replacement.

---

**Question:** Is your API idempotent and what about retries?

**Strong interview answer:** GET, PUT and DELETE are idempotent in effect (repeating a PUT yields the same state; a repeated DELETE returns 404 after the first). POST create is not — a retry would make a duplicate. In the UI, submit buttons are disabled while a request is in flight, which prevents the common double-click duplicate.

**Why this answer is correct:** Accurate semantics and an honest statement of what protects POST.

**Possible follow-up:** ⭐ How would you prevent duplicate requests properly?

**Ideal follow-up answer:** Idempotency keys: the client sends an `Idempotency-Key` header, the server stores key → response for some time (unique index on key + user) and returns the stored result on replay. Plus natural unique constraints where a duplicate is meaningful, and disabling controls in the UI.

---

**Question ⭐:** How would you add pagination — and what did you do?

**Strong interview answer:** It's implemented: `page` and `pageSize` (max 100), PostgREST `.range(from, to)` with `count: 'exact'`, and the response `meta` has `total` and `totalPages`; a stable secondary `ORDER BY id` keeps pages deterministic. That's offset pagination, which is simple and supports "jump to page N". Its weaknesses are deep offsets (the DB still scans skipped rows) and drifting results when data changes between requests.

**Why this answer is correct:** Describes exact implementation and the known weakness.

**Possible follow-up:** What would you use instead for very large lists?

**Ideal follow-up answer:** Keyset (cursor) pagination: order by `(created_at, id)` and request `WHERE (created_at, id) < (:lastCreatedAt, :lastId) LIMIT n`. It's O(log n) via the index regardless of depth and stable under inserts; the trade-off is no random page access.

---

## 13. API security

**Question ⭐:** How do you prevent SQL injection?

**Strong interview answer:** I never build SQL strings from input. All access is through the Supabase/PostgREST query builder, which sends values as parameters/URL-encoded filter operands, never concatenated into SQL. On top of that: UUIDs validated by regex, enums validated against whitelists, `sort` mapped through a whitelist object to real column names, and `LIKE` wildcards in search escaped so `%` and `_` are literals. The one SQL function I wrote (`get_dashboard_stats`) takes no user input. I also sent an `' OR 1=1 --` search through the running API and it simply matched nothing.

**Why this answer is correct:** Explains the core rule (parameterisation) plus layered input hardening that is actually in the code.

**Possible follow-up:** Is the `ilike` search itself a risk?

**Ideal follow-up answer:** Not for injection, but unescaped `%`/`_` would let users create expensive pattern scans and wrong matches; `escapeLike` neutralises that, and `search` is capped at 100 chars. Trigram indexes keep it fast.

---

**Question ⭐:** Why is CORS relevant, and how is it configured here?

**Strong interview answer:** CORS governs whether a browser lets JavaScript from *another origin* read responses from my API. My UI and API share an origin, so I emit no CORS headers — which means other sites' scripts can't read authenticated responses. If I later served a separate front-end or a partner site, I'd add an explicit allow-list of origins with `Access-Control-Allow-Credentials` and never use `*` together with credentials. CORS is not a server-side security control: curl and mobile apps ignore it, so it complements — never replaces — authentication.

**Why this answer is correct:** Gives the exact config of this project and the common misconception.

**Possible follow-up:** Would your API work for a mobile app?

**Ideal follow-up answer:** Not without a change: it authenticates via cookies only. A mobile client would send `Authorization: Bearer <access_token>`; I'd create the Supabase client with that header when present, and return tokens from login in the body for non-browser clients. Mobile apps don't need CORS, but need secure token storage (Keychain/Keystore).

---

**Question:** What rate limiting do you have and how would you improve it?

**Strong interview answer:** Login: 10 attempts per 15 minutes per IP; register: 5 per hour per IP; exceeding returns 429 with `Retry-After`. It's an in-memory fixed window, so it's per server instance and resets on deploy — on serverless it's only a speed bump. Supabase Auth has its own limits too. Improve with a shared store (Upstash Redis) using a sliding window, key by IP and by account email, and add exponential backoff/CAPTCHA after repeated failures.

**Why this answer is correct:** Accurately states numbers, the code behaviour, and the limitation.

**Possible follow-up:** Can the IP be spoofed?

**Ideal follow-up answer:** `x-forwarded-for` can be forged unless the platform overwrites it. On Vercel the edge sets it, but behind other proxies I'd use the proxy's trusted-IP header or configure trusted hops.

---

## 14. Validation

**Question ⭐:** Why validate on both frontend and backend?

**Strong interview answer:** They serve different purposes. Frontend validation is for user experience — instant, field-level feedback with no round trip. Backend validation is for security and integrity — any client, including curl or a modified browser, can bypass the UI. So I use the same Zod schemas in both places (shared module), and the server treats every request as hostile. A third layer, database CHECK constraints, protects against bugs in both.

**Why this answer is correct:** Distinguishes UX from security and mentions defence in depth with concrete implementation.

**Possible follow-up:** What does your date validation catch that `new Date()` wouldn't?

**Ideal follow-up answer:** `new Date('2026-02-31')` rolls over to March 3; my `isoDateSchema` checks the `YYYY-MM-DD` format and then verifies the parsed date round-trips to the same year/month/day, rejecting impossible dates. It also rejects an `endDate` earlier than `startDate`, and the DB CHECK repeats that rule.

---

**Question:** How do partial updates work with validation?

**Strong interview answer:** The update schemas make every field optional, require at least one key, and have no defaults (a default would overwrite existing data when a field is omitted). `undefined` keys are dropped in `toProjectRow`; `null` explicitly clears nullable dates. Cross-field rules (end ≥ start) are checked in Zod when both are present and again by the DB constraint when only one is sent — mapped to `INVALID_DATE_RANGE`.

**Why this answer is correct:** Reflects `validations/project.js`, `mappers.js` and `db/errors.js` and a subtle correctness issue.

**Possible follow-up:** What about whitespace-only names?

**Ideal follow-up answer:** `requiredText` trims first, then requires length ≥ 1, so `"   "` is rejected; the DB CHECK uses `btrim(name)` as well.

---

## 15. Error handling

**Question:** How do you make sure database errors don't leak to users?

**Strong interview answer:** Data-access functions catch PostgREST errors and pass them to `dbError`, which maps known SQLSTATEs to safe `ApiError`s (23514 → 400, 23503 → 404, 22P02 → 400, 42501 → 403, connectivity → 503) and anything else to a generic `DATABASE_ERROR`. The raw message is written to server logs only. Unknown exceptions hit the wrapper's `handleError` → `500 INTERNAL_ERROR` with a generic text. Tests assert that internal strings like "function does not exist" never appear in a response.

**Why this answer is correct:** Matches the code and tests.

**Possible follow-up:** How do you know about errors in production?

**Ideal follow-up answer:** Structured JSON logs (`level`, `method`, `path`, `status`, `ms`) go to the platform's log drain; I'd add Sentry for exceptions with request ids and alerts on 5xx rates.

---

**Question:** What does the user see on network failure, expired session, 404 and empty data?

**Strong interview answer:** The fetch wrapper turns a network failure into `NETWORK_ERROR`; first load shows an error card with "Try again"; if data is already on screen a banner says "Can't reach the server… showing the last data" with Retry. A 401 redirects to login with a message. A missing project shows a "Project not found" state; empty lists show helpful empty states with a call to action; filters with no results show "No matching…" with *Clear filters*. Buttons are disabled with a spinner during requests and always reset in `finally`.

**Why this answer is correct:** Every state exists in the UI and was exercised in the browser run, including the offline banner.

**Possible follow-up:** What bug did the offline test uncover?

**Ideal follow-up answer:** With data already loaded the UI silently kept showing stale data when offline. I added the "couldn't refresh" banner so users know the data may be outdated.

## 16. Frontend state management

**Question:** How do you manage state in the frontend and why SWR?

**Strong interview answer:** I separate *server state* from *UI state*. Server state (projects, tasks, dashboard, current user) is cached and revalidated by SWR, keyed by URL including query params, so every filter combination has its own entry. UI state (form values, dialog open flags, filter inputs) is local `useState`. There's no global store because nothing needs to be shared across distant components beyond the cache. SWR gives deduping, revalidation on focus, and `keepPreviousData` so lists don't flash while filtering.

**Why this answer is correct:** Reflects `hooks/use-api.js` and avoids unnecessary Redux-style machinery.

**Possible follow-up:** How do you keep the dashboard correct after a task changes?

**Ideal follow-up answer:** After every write, `revalidateData()` calls SWR's global `mutate` with a key filter, clearing cached `/api/projects*`, `/api/tasks*` and `/api/dashboard` entries and refetching the mounted ones. I found a real bug during browser testing: cached dashboard data from before showed briefly when navigating back. Clearing unmounted caches while keeping previous data for mounted views fixed the stale flash.

---

**Question:** Why do you use `window.location.assign` after login and logout?

**Strong interview answer:** A full page navigation guarantees the browser uses the newly set (or cleared) cookies and discards the in-memory SWR cache. With client-side routing, user B could briefly see user A's cached data after switching accounts in the same tab.

**Why this answer is correct:** It addresses a real cross-user data-leak risk in SPA caches.

**Possible follow-up:** Alternative?

**Ideal follow-up answer:** Call `mutate(() => true, undefined, { revalidate: false })` to wipe the whole cache then `router.replace` — equivalent, but the hard navigation is simpler and also resets other module-level state.

---

## 17. Search and filtering

**Question:** How is search and filtering implemented end to end?

**Strong interview answer:** UI: a debounced search box plus selects for status/priority/project. Those values are sent as query params (`search`, `status`, `priority`, `projectId`). Server: `parseQuery` validates them with Zod (enums, uuid, length ≤ 100); the data layer applies `.ilike('name', '%escaped%')`, `.eq('status', …)` etc., with `count: 'exact'` and `.range()` for pagination. Empty results render a "No matching …" state with a Clear filters button.

**Why this answer is correct:** Mirrors the code from the UI to `lib/db/tasks.js`.

**Possible follow-up:** How is name search kept fast?

**Ideal follow-up answer:** `pg_trgm` GIN indexes on `projects.name` and `tasks.name` support `ILIKE '%term%'`, which a B-tree cannot. RLS adds an owner predicate that uses the `(owner_id, …)` index.

---

**Question ⭐:** How would you add full-text search?

**Strong interview answer:** Add a generated `tsvector` column, e.g. `search tsvector generated always as (setweight(to_tsvector('english', name), 'A') || setweight(to_tsvector('english', description), 'B')) stored`, with a GIN index. Query with `websearch_to_tsquery('english', :q)` and rank via `ts_rank`. Through PostgREST/supabase-js that's `.textSearch('search', q, { type: 'websearch' })`. Full-text handles stemming, stop words and multi-word relevance, which `ILIKE` can't; it doesn't do substring or typo matching, so I'd combine it with trigram similarity for fuzzy matches.

**Why this answer is correct:** Standard PostgreSQL FTS with the right operators and trade-off.

**Possible follow-up:** Search across both projects and tasks?

**Ideal follow-up answer:** Either a SQL function/view that unions both with a `type` column and ranks them together, or a dedicated `search_documents` table maintained by triggers. For very large/complex needs, an external engine like Typesense or Meilisearch.

---

## 18. Performance

**Question ⭐:** How would you optimise a task list containing 100,000 tasks?

**Strong interview answer:** Layers. Query side: always filter by selective indexed columns (`project_id`, status, owner via RLS), use keyset pagination instead of deep offsets, avoid `count: 'exact'` on huge sets (use `planned`/`estimated` counts or drop the total and show "next"), select only needed columns, and verify plans with `EXPLAIN ANALYZE` under the user's role. Index side: composite/partial indexes matching real filters; trigram or FTS index for search. UI side: server-side pagination (already), and list virtualisation for long scrolling lists. Architecture: cache expensive aggregates per user with short TTLs and invalidate on writes; move big recomputations to materialised views.

**Why this answer is correct:** It identifies the actual costs (offset scans, exact counts, unindexed filters, rendering) and gives targeted fixes.

**Possible follow-up:** Why is `count: 'exact'` a problem?

**Ideal follow-up answer:** It makes PostgreSQL scan all matching rows to compute the total on every request; on huge tables that dominates the latency. Estimated counts from planner statistics are instant but approximate.

---

**Question ⭐:** How would you implement caching?

**Strong interview answer:** Client: SWR already caches per key and revalidates. HTTP: responses are user-specific so they must be `Cache-Control: private, no-store`-style — never shared CDN caching. Server: for expensive per-user aggregates like the dashboard, a short TTL cache (Redis/Vercel KV) keyed by user id, invalidated in the write handlers. Data: materialised views for heavy rollups. I'd avoid caching authorization decisions, and I'd measure first because Postgres with proper indexes is fast at this scale.

**Why this answer is correct:** Handles the key trap — caching private data in shared caches — and gives invalidation.

**Possible follow-up:** What's the hardest part of caching?

**Ideal follow-up answer:** Invalidation: knowing every write path that affects a cached value (task create/update/delete, project delete cascades) and staying consistent. That's why I'd start with short TTLs and event-based invalidation only on the hot dashboard.

---

**Question ⭐:** How do you handle concurrent updates?

**Strong interview answer:** Today it's last-write-wins: two people editing the same task, the second save overwrites the first. Single-field inline changes (status, priority) only send that field, which narrows the window. To fix it properly use optimistic concurrency: send the `updatedAt` you loaded, and update with `WHERE id = :id AND updated_at = :loaded`; zero rows means someone else changed it, so return `409 CONFLICT` and let the user reload/merge. Alternatively a `version` integer incremented by a trigger, or pessimistic `SELECT … FOR UPDATE` inside a transaction for short critical sections.

**Why this answer is correct:** Honest about current behaviour and gives the standard solutions with the exact SQL idea; `updated_at` already exists via trigger.

**Possible follow-up:** Why partial updates help but don't solve it?

**Ideal follow-up answer:** Disjoint fields don't clash, but two edits of the same field still overwrite, and a read-modify-write on the client can resurrect stale values for other fields if you send the whole object.

---

## 19. Testing

**Question ⭐:** How would you / did you test authorization?

**Strong interview answer:** At three levels. SQL: `tests/sql/rls.test.sql` inserts two users, switches to `authenticated` with each user's `request.jwt.claims`, and asserts user B sees 0 of A's rows, can't update/delete (0 rows), can't insert into A's project, can't change `owner_id`, can't move a task across owners, and that `anon` has no access — 32 assertions. Integration: the real data layer through PostgREST with signed JWTs for two users, verifying 404s for get/update/delete and filter/dashboard isolation. Route tests: 401 on every endpoint without a session, 404 for foreign ids, forged `owner_id` ignored. Plus an end-to-end browser run and a curl cross-user script.

**Why this answer is correct:** Tests the control where it lives (DB), plus API and UI, with concrete counts that are true for this repo.

**Possible follow-up:** What can the mocked route tests *not* prove?

**Ideal follow-up answer:** They use a fake Supabase client, so they prove my handler logic (auth gate, validation, error mapping) but not that RLS really blocks a row — that's why the SQL and PostgREST integration tests exist.

---

**Question:** What did you NOT test and what's the risk?

**Strong interview answer:** I couldn't connect to a real Supabase project, so Supabase Auth itself wasn't exercised — my browser E2E used a small stand-in that issues signed JWTs to a real PostgREST/Postgres. The SDK calls are standard, but sign-up/confirmation emails, the real cookie names/refresh timing and dashboard config (redirect URLs) must be validated against a real project. I also have no committed browser E2E suite and no load tests. Nothing was deployed.

**Why this answer is correct:** Honest scoping prevents embarrassment if the interviewer tries it live.

**Possible follow-up:** How would you close that gap?

**Ideal follow-up answer:** Run the app against a dedicated Supabase test project in CI (via the Supabase CLI local stack or a hosted project), add Playwright tests for the critical flows, and run them on every PR.

---

## 20. Deployment

**Question ⭐:** How would you deploy this?

**Strong interview answer:** Create the Supabase project and run `schema.sql`. Push to GitHub, import into Vercel (Next.js preset), set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables (no service key), deploy. In Supabase Auth → URL Configuration set the Site URL to the Vercel URL and add it to the redirect allow-list so email confirmation links work. Smoke-test register → project → task → dashboard. CI (lint, tests, build) gates merges. There are no localhost assumptions: the confirmation redirect uses the request origin and API calls are relative.

**Why this answer is correct:** Matches README steps and identifies the commonly forgotten step (auth redirect URLs).

**Possible follow-up:** It works locally but login fails in production. What do you check?

**Ideal follow-up answer:** Env vars set for the right Vercel environment and redeployed (public vars are inlined at build time); Supabase Site URL/redirect URLs; Secure cookies requires HTTPS (fine on Vercel); browser network tab for 401/429/503 codes and the `error.code` in the JSON; Vercel function logs; that the schema was run on that Supabase project; whether email confirmation is enabled and the user confirmed.

---

**Question:** Why are the `NEXT_PUBLIC_` variables safe, and why does changing them require a rebuild?

**Strong interview answer:** They hold the project URL and anon key, which are public by design — RLS is the protection. Next inlines `NEXT_PUBLIC_*` values into the JavaScript at build time, so changing them requires a redeploy; server-only variables are read at runtime on the server.

**Why this answer is correct:** Correct Next semantics and the Supabase security model.

**Possible follow-up:** What would be wrong with `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`?

**Ideal follow-up answer:** The `NEXT_PUBLIC_` prefix ships it to every visitor's browser, handing everyone full admin access to the database. Never.

---

## 21. Git / GitHub

**Question ⭐:** What should never be committed to GitHub?

**Strong interview answer:** Secrets and local state: `.env`/`.env.local`, API keys (especially the Supabase service-role key), database passwords, private keys/certs, `node_modules`, `.next` build output, logs, editor files, and any real personal data. `.gitignore` blocks them and `.env.example` documents variable names with empty values. If a secret is ever committed: rotate it immediately (deleting the file doesn't remove it from history), then purge history with `git filter-repo`/BFG and force-push, and check for forks/caches.

**Why this answer is correct:** Lists the real hazards for this repo and the correct incident response (rotate first).

**Possible follow-up:** How do you check before pushing?

**Ideal follow-up answer:** `git status` and `git ls-files | grep -E "\.env|node_modules"`, `git diff --cached`, plus a secret scanner (gitleaks/GitHub secret scanning/push protection) in CI.

---

**Question:** How would you structure commits and branches?

**Strong interview answer:** Small, focused commits with conventional messages (`feat:`, `fix:`, `docs:`, `test:`), feature branches, and pull requests that must pass CI (lint, tests, build) before merging to `main`. The first commit message summarises the stack and features.

**Why this answer is correct:** Standard practice; CI workflow exists in the repo.

**Possible follow-up:** Why include a CI workflow in a small project?

**Ideal follow-up answer:** It proves the repo builds from a clean checkout with `npm ci` and keeps regressions from being merged; it's one small YAML file.

---

## 22. Security

**Question ⭐:** What vulnerabilities would you look for in this project?

**Strong interview answer:** A checklist: (1) Broken access control / IDOR — RLS on every table, no table without policies, views as security invoker. (2) Authentication — rate limiting, enumeration at register, token storage, session fixation. (3) Injection — any string-built SQL (none), `dangerouslySetInnerHTML` (only a constant theme script), unsafe URL building. (4) XSS — React escapes output; user text is rendered as text, not HTML. (5) CSRF — SameSite cookies + JSON content type; consider Origin checks. (6) Mass assignment — whitelisted fields. (7) Open redirects — `next` is restricted to same-site paths. (8) Information leakage — generic errors, no stack traces. (9) Secrets — service key not used, nothing committed. (10) Dependencies — `npm audit`, Dependabot. (11) Security headers/CSP — I set frame, nosniff, referrer and permissions headers but no Content-Security-Policy yet.

**Why this answer is correct:** Maps each class to a concrete control or gap in this codebase and admits the missing CSP.

**Possible follow-up:** How would you add a CSP?

**Ideal follow-up answer:** Use middleware to set a nonce-based policy (`script-src 'self' 'nonce-…'`) — my inline theme script would need the nonce (or be moved to an external file) — plus `connect-src 'self'`, `frame-ancestors 'none'`, and report-only mode first to find breakage.

---

**Question:** Walk me through how your app resists XSS.

**Strong interview answer:** React escapes all interpolated values, and user content (names, descriptions) is rendered as text. I don't use `dangerouslySetInnerHTML` for user data; the only use is a constant script that sets the dark-mode class before paint. Session cookies are HttpOnly, so even if XSS happened it couldn't read the tokens (though it could still make authenticated requests). The `next` redirect parameter is restricted to local paths to avoid script/open-redirect abuse.

**Why this answer is correct:** Shows prevention and impact reduction, and is honest that HttpOnly doesn't eliminate XSS impact.

**Possible follow-up:** What else reduces impact?

**Ideal follow-up answer:** A strict CSP, short token lifetimes, re-authentication for sensitive actions, and `SameSite` cookies.

---

## 23. Scalability

**Question ⭐:** How would you scale this system?

**Strong interview answer:** The Next.js tier is stateless, so it scales horizontally on Vercel; the in-memory rate limiter must move to a shared store. The database is the real bottleneck: add the right indexes (already), use Supabase's pooler for connections, scale compute, add read replicas for read-heavy dashboards, keyset pagination, cached aggregates, and materialised views. Move long-running or heavy work (exports, notifications) to background jobs/queues. Add observability (logs, tracing, metrics) to find actual bottlenecks before optimising. If the team or traffic grows, extract the API into its own service.

**Why this answer is correct:** Separates stateless from stateful scaling, and ties to concrete limitations of this repo.

**Possible follow-up:** What breaks first?

**Ideal follow-up answer:** Probably the dashboard/aggregate queries and `count: 'exact'` on large tables, then connection limits on the database, before the Next.js tier.

---

**Question ⭐:** What happens if Supabase is unavailable?

**Strong interview answer:** The app can't authenticate or read/write data, but it degrades predictably. Auth checks fail with a retryable error, which I map to `503 SERVICE_UNAVAILABLE` (not 401, so users aren't wrongly logged out). The UI shows an error card with *Try again*, keeps already-loaded data on screen with a "couldn't refresh" banner, and mutations show error toasts without leaving buttons stuck. SWR retries a couple of times for non-4xx errors. Beyond that: monitor Supabase status, set alerts on 5xx, and for higher availability use read replicas/multi-region or a standby plan.

**Why this answer is correct:** Describes real behaviours in `handler.js`, `use-api.js` and the UI.

**Possible follow-up:** Could the app work offline?

**Ideal follow-up answer:** Not currently. It would need a service worker with a cached read model and a queued-writes strategy with conflict handling, which is a major feature; I'd scope it as a PWA phase.

---

**Question ⭐:** How would you add audit logs?

**Strong interview answer:** An append-only `audit_log` table (`id`, `actor_id`, `table_name`, `row_id`, `action`, `old_data jsonb`, `new_data jsonb`, `created_at`) populated by `AFTER INSERT/UPDATE/DELETE` triggers on projects and tasks that read `auth.uid()`. Triggers capture every change regardless of which code path made it. RLS lets owners read their own entries and nobody update/delete them; partition by month if it grows. A UI "Activity" tab per project can read from it.

**Why this answer is correct:** Triggers guarantee completeness, and `auth.uid()` identifies the actor in the same DB session.

**Possible follow-up:** What are the downsides of trigger-based auditing?

**Ideal follow-up answer:** Extra write cost and table growth, difficulty capturing request context (IP, user agent) unless passed via session settings, and sensitive data duplication in `jsonb` — so redact fields and set retention.

---

## 24. Design decisions

**Question:** Why did you build your own small component library instead of shadcn/ui?

**Strong interview answer:** The UI needed about a dozen primitives. Writing them directly on Tailwind tokens kept dependencies minimal, avoided CLI/registry setup, and made accessibility choices explicit (native `<dialog>`, labelled fields wired with ids, `aria-live` toasts). The trade-off is that I own maintenance, and shadcn/Radix would give more battle-tested keyboard handling for complex widgets (comboboxes, menus).

**Why this answer is correct:** Honest justification with the real costs.

**Possible follow-up:** What would you adopt first if the UI grew?

**Ideal follow-up answer:** Radix primitives for select/popover/dropdown (accessible and unstyled), keeping my tokens and styling.

---

**Question:** Why a custom response envelope and error codes?

**Strong interview answer:** A consistent `{success, data|error}` shape means the client has one code path for success and failure; stable machine-readable `code`s (e.g., `PROJECT_NOT_FOUND`) let the UI branch without parsing messages, and `details[]` carries field-level validation errors straight into form fields. Messages are safe for humans.

**Why this answer is correct:** It's the practical reason and matches `ApiResponse` types and form code.

**Possible follow-up:** Criticism of envelopes?

**Ideal follow-up answer:** HTTP status codes already convey success/failure, so `success` is redundant; some prefer RFC 9457 `application/problem+json`. I chose the shape requested in the brief and kept the status codes correct as well.

---

## 25. Trade-offs

**Question ⭐:** How would you migrate away from Supabase?

**Strong interview answer:** The data is plain PostgreSQL: `pg_dump` the `public` schema and data. Auth is the real replacement: stand up another provider (Auth0, Clerk, Keycloak) or self-managed — Supabase stores bcrypt hashes, which can be exported and imported by providers that support bcrypt so users keep passwords. Code impact is contained: `lib/supabase/*` (session/cookies) and `lib/db/*` (queries) are the only places that know about Supabase; the routes, validation, and UI don't change. I'd replace PostgREST calls with a SQL client/ORM (pg, Drizzle, Prisma), and RLS can stay (set `request.jwt.claims`-style settings per request) or move into application authorization — the former keeps the defence-in-depth property.

**Why this answer is correct:** Identifies precisely the coupling points in this repo and the hard part (auth/session), with a credible data migration.

**Possible follow-up:** What would you lose?

**Ideal follow-up answer:** The managed convenience (Auth, PostgREST, dashboard, backups, email) and the automatic RLS-with-JWT integration — I'd need to rebuild that session-to-database-identity plumbing myself.

---

**Question:** What are the main trade-offs in your design?

**Strong interview answer:** (1) Next route handlers vs a separate backend: simplicity vs independent scaling. (2) RLS-first authorization vs app-level checks: strong guarantees but harder to debug (empty results instead of errors) and logic lives in SQL. (3) Client components + SWR vs server components: interactivity vs first-paint/SEO (irrelevant behind a login). (4) CHECK constraints vs enums: easy evolution vs type safety. (5) Offset pagination: simple vs deep-page cost. (6) In-memory rate limiting: zero infra vs weaker guarantees. (7) Computing counts live vs storing them: always correct vs read cost at scale.

**Why this answer is correct:** Each trade-off is real and mapped to a decision in the repository.

**Possible follow-up:** Which one would you revisit first?

**Ideal follow-up answer:** The rate limiter (shared store) and generated database types — they're cheap to change and remove the biggest known weaknesses.

---

## 26. Debugging

**Question:** A user says "I logged in but my project list is empty." How do you debug?

**Strong interview answer:** Reproduce and narrow by layer. Network tab: does `/api/projects` return 200 with `data: []` or an error? If 401 → session/cookie problem (cookie not set, Secure cookie on HTTP, expired). If 200 empty → it's data/authorization: confirm the logged-in user's id (`/api/auth/me`) matches `projects.owner_id` in the table editor; check RLS in the SQL editor by `set local role authenticated; select set_config('request.jwt.claims', '{"sub":"<id>"}', true); select * from projects;`. Check filters in the URL (a leftover `status`/`search`), and that the schema/policies were actually applied. Check logs for `DATABASE_ERROR`.

**Why this answer is correct:** A systematic top-down method that uses the repo's own tooling and RLS test technique.

**Possible follow-up:** Why do RLS problems often look like "empty results" rather than errors?

**Ideal follow-up answer:** RLS filters rows silently instead of raising errors for reads, so a policy mismatch (wrong `owner_id`, missing `auth.uid()`, wrong role) yields zero rows. Only `WITH CHECK` failures on writes raise errors.

---

**Question:** How did you debug issues while building this?

**Strong interview answer:** Examples: Next's route handler signature needed separate `withAuth` and `withAuthParams` wrappers. Browser testing showed stale dashboard numbers after navigation — I fixed SWR cache invalidation. Looking at actual `Set-Cookie` headers revealed the library's default cookies weren't HttpOnly — I hardened them. The offline test showed silent stale data — I added a banner. Each fix was re-verified by tests or a browser run.

**Why this answer is correct:** All of these are real issues from this build; they show method, not just outcomes.

**Possible follow-up:** What tool gives you the quickest signal for API bugs?

**Ideal follow-up answer:** `curl -i` with a cookie jar to see exact status codes, headers and the JSON error `code`, then server logs (structured JSON lines with method/path/status/ms).

---

## 27. Possible future improvements

**Question ⭐:** What would you improve if given another week?

**Strong interview answer:** In priority order: (1) Run against a real Supabase project in CI with Playwright E2E tests. (2) Generate DB types (`supabase gen types`) to remove the casts. (3) Shared Redis rate limiting and an Origin check for cookie-authenticated writes. (4) Optimistic concurrency (`updated_at`/`version` → 409) and idempotency keys. (5) Content-Security-Policy with nonces. (6) Project members + RBAC and an audit log. (7) Keyset pagination and FTS search. (8) Password reset/change email UI, profile editing. (9) Bearer-token support so a mobile client can use the same API. (10) Observability: Sentry, request ids, metrics.

**Why this answer is correct:** It's prioritised by risk and ties to the limitations the README admits.

**Possible follow-up:** Why those first?

**Ideal follow-up answer:** They close the biggest verification gap (real Auth) and cheap-but-meaningful safety issues (types, rate limit, CSRF depth) before adding features.

---

**Question:** If you were to add real-time collaboration, how?

**Strong interview answer:** Use Supabase Realtime (Postgres changes) on `tasks`/`projects` with RLS-respecting channels so clients receive only rows they're allowed to see; this requires a browser Supabase client with the user's JWT (which I deliberately don't have today, so I'd weigh moving tokens into a readable cookie or issuing a separate short-lived realtime token). Update the SWR cache on events and handle conflicts via optimistic concurrency.

**Why this answer is correct:** Identifies the real architectural consequence for the HttpOnly-cookie design.

**Possible follow-up:** Alternative without exposing tokens?

**Ideal follow-up answer:** Server-Sent Events from a route handler that subscribes server-side and streams filtered events to the browser; it keeps tokens HttpOnly but needs a long-lived connection (a poor fit for serverless time limits).
