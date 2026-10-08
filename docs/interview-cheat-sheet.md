# Interview cheat sheet (read 30 minutes before)

**One-line pitch:** *An authenticated, multi-tenant project and task management web application built with Next.js, JavaScript and Supabase PostgreSQL, with REST-style API routes, server-side validation, secure authentication, Row Level Security and a responsive SaaS-style dashboard.*

**Scope:** WEB ONLY. No mobile app (the brief's mobile part was intentionally excluded).

## Architecture in 30 seconds
Browser → Next.js app → API route handlers → Supabase (Auth + PostgreSQL + RLS). The browser only calls my own `/api/*` (same origin, HttpOnly session cookie). Each handler: **authenticate → validate (Zod) → query as the user → JSON envelope**. The service-role key is never used.

## Database in 30 seconds
`auth.users → profiles → projects → tasks`. UUID PKs, FKs with `ON DELETE CASCADE`, CHECK constraints for enums/lengths/date order, `created_at/updated_at` (trigger), indexes on FKs + filters + trigram on names. A `security_invoker` view gives task counts; a SQL function gives dashboard aggregates. Counts are computed, not stored.

## Authentication in 30 seconds
Supabase Auth, email+password. Passwords bcrypt-hashed by Supabase, never in my tables/responses. Server routes call `signUp`/`signInWithPassword`; `@supabase/ssr` stores the session in **HttpOnly, SameSite=Lax, Secure(prod)** cookies. Every request: `getUser()` verifies the token with Supabase (refreshing if needed). Expired → 401 `SESSION_EXPIRED` → redirect to login with a message. Rate limit on login/register.

## Authorization in 30 seconds
Two layers. App: identity from the verified session; `owner_id` never from the body; ids validated as UUIDs. Database: **RLS** — `owner_id = auth.uid()` on projects, tasks via `EXISTS` on their project; `WITH CHECK` stops giving data away or moving tasks into others' projects. Foreign ids → **404** (no probing). `anon` has no privileges.

## Security in 30 seconds
Zod validation server-side (+ client); parameterised queries only; LIKE wildcards escaped; sort whitelist; generic error messages; rate limiting; security headers; JSON-only writes; open-redirect-safe `next`; HttpOnly cookies; no secrets in repo; RLS + tests. **Gaps:** no CSP yet, in-memory rate limiter, register reveals existing emails.

## API design in 30 seconds
Resource URLs from the brief; GET/POST/PUT/DELETE; `201` on create; partial updates via PUT; pagination `page/pageSize` + `meta`; filters/sort in query; one envelope `{success,data,meta}` / `{success:false,error:{code,message,details}}`; stable error codes; consistent status codes (400/401/403/404/409/415/429/500/503).

## Deployment in 30 seconds
Supabase: create project → run `schema.sql` → set Site URL + redirect URLs. Vercel: import repo → set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` → deploy. No service key. CI: lint, test, build.

## Main trade-offs
Next route handlers (simple) vs separate backend (scales independently) · RLS-first (strong, harder to debug) · client components + SWR (interactive) vs server rendering · CHECK vs enum · offset pagination (simple) vs keyset · in-memory rate limit vs Redis · computed counts vs stored.

## What was tested (be exact)
**77 unit/route tests** (mocked Supabase) · **32 SQL/RLS assertions** on real PostgreSQL 16 · **20 integration tests** on real PostgREST + Postgres · lint and production build · a real-browser E2E run (35 checks) with a **stand-in for Supabase Auth**. **Not tested:** real Supabase Auth/email, deployment.

## Top 20 questions — short answers
1. **Why Supabase?** Managed Postgres + Auth (hashing, tokens), RLS, no local DB; trade-off vendor coupling.
2. **Why Next route handlers?** One repo/deploy, shared types/schemas, real REST endpoints; coupled scaling.
3. **Why not Firebase?** Relational data needs FKs/joins/constraints; brief requires PostgreSQL/MySQL.
4. **What is RLS?** Per-table policies the DB appends to every query; `USING` filters rows, `WITH CHECK` validates writes; default deny.
5. **How does RLS isolate users?** JWT → `auth.uid()`; policy `owner_id = auth.uid()`; foreign rows invisible (0 rows), forged inserts rejected.
6. **Where's the JWT?** HttpOnly cookie set server-side; not readable by JS.
7. **Token expires?** Refresh token renews silently; if that fails → 401 SESSION_EXPIRED → login with message.
8. **Why never expose service_role?** Bypasses RLS = full DB access; app doesn't use it.
9. **Frontend request tampered?** Server validates everything; owner from session; RLS enforces; 400/401/404.
10. **IDOR?** RLS + 404 for foreign ids + UUID validation + task access via project.
11. **SQL injection?** No string SQL; parameterised builder; enum/uuid/sort whitelists; escaped LIKE.
12. **Why validate both sides?** UX vs security; shared Zod schemas; DB CHECKs as a third layer.
13. **Why UUID / FKs / separate tables?** Unguessable & distributed; integrity + cascade; 1-to-many normalisation.
14. **Pagination?** Offset `page/pageSize` + exact total now; keyset for huge lists.
15. **100k tasks?** Indexes, keyset paging, avoid exact counts, virtualise UI, cache aggregates.
16. **Full-text search?** `tsvector` generated column + GIN + `websearch_to_tsquery`.
17. **RBAC?** `project_members(role)` + membership-based policies via a security-definer helper.
18. **Concurrent updates / duplicates?** Today last-write-wins; add `updated_at` optimistic locking (409) and idempotency keys.
19. **Supabase down?** 503 not 401, error states, keep data with banner, retries; monitoring/replicas.
20. **Another week?** Real-Supabase CI + Playwright, generated DB types, Redis rate limit, CSP, RBAC/audit log, Bearer support.

## Important terminology
**RLS** row level security · **USING / WITH CHECK** read-visibility vs write-validity predicates · **JWT** signed token with `sub`, `role`, `exp` · **anon key** public identifier · **service_role** RLS-bypassing secret · **PostgREST** auto REST layer over Postgres · **IDOR** access by changing an id · **mass assignment** writing client-supplied fields blindly · **CSRF** cross-site request forgery (SameSite, content-type) · **XSS** script injection (HttpOnly limits token theft) · **idempotent** repeat = same effect · **keyset pagination** cursor on indexed sort key · **security_invoker** view runs with caller's rights · **SECURITY DEFINER** function runs with owner's rights (pin `search_path`) · **initplan** subquery evaluated once · **trigram (pg_trgm)** index for `ILIKE '%x%'` · **stale-while-revalidate** SWR strategy · **optimistic concurrency** version check on update.

## If you blank, say this
"Every request is authenticated, validated, and executed as the user; PostgreSQL's Row Level Security makes ownership a property of the database, not just my code — and I tested that with SQL assertions as two different users."
