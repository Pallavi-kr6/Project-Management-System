# Database schema

Source of truth: [`supabase/schema.sql`](../supabase/schema.sql) (PostgreSQL 15+, i.e. any current Supabase project). It is **idempotent**: you can run it repeatedly.

## ER diagram

```
┌──────────────────────┐
│ auth.users (Supabase)│   managed by Supabase Auth; passwords are bcrypt-hashed here,
│  id  uuid  PK        │   in a schema our app cannot read
│  email, …            │
└──────────┬───────────┘
           │ 1                      trigger on_auth_user_created
           │                        (INSERT profile automatically)
           │ 1
┌──────────▼───────────┐
│ public.profiles      │
│  id         uuid PK  │──── FK → auth.users(id)  ON DELETE CASCADE
│  full_name  text     │
│  email      text UQ  │
│  created_at timestamptz
│  updated_at timestamptz
└──────────┬───────────┘
           │ 1
           │
           │ * (a user owns many projects)
┌──────────▼───────────┐
│ public.projects      │
│  id          uuid PK │
│  owner_id    uuid    │──── FK → profiles(id)  ON DELETE CASCADE
│  name        text    │      CHECK 1..120 chars (trimmed)
│  description text    │      CHECK ≤ 2000
│  status      text    │      CHECK IN ('Not Started','In Progress','Completed')
│  start_date  date    │
│  end_date    date    │      CHECK end_date >= start_date (when both set)
│  created_at, updated_at
└──────────┬───────────┘
           │ 1
           │
           │ * (a project has many tasks)
┌──────────▼───────────┐
│ public.tasks         │
│  id          uuid PK │
│  project_id  uuid    │──── FK → projects(id)  ON DELETE CASCADE
│  name        text    │      CHECK 1..160 chars (trimmed)
│  description text    │      CHECK ≤ 2000
│  priority    text    │      CHECK IN ('Low','Medium','High')
│  status      text    │      CHECK IN ('Pending','In Progress','Completed')
│  due_date    date    │
│  created_at, updated_at
└──────────────────────┘

Derived objects
  view     public.projects_with_stats   projects.* + total_tasks + completed_tasks   (security_invoker)
  function public.get_dashboard_stats() jsonb of the caller's counts                 (security invoker)
```

Cardinality: a user has 0..n projects; a project belongs to exactly one user and has 0..n tasks; a task belongs to exactly one project.

## Tables

### `profiles`
App-level data for a user. The credentials stay in `auth.users`.

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users(id)` `ON DELETE CASCADE` (deleting the auth user deletes everything they own) |
| `full_name` | `text` | NOT NULL, 1–100 trimmed chars. Filled from sign-up metadata, falling back to the email prefix |
| `email` | `text` | NOT NULL, UNIQUE (assignment: unique email) — Supabase Auth also enforces uniqueness |
| `created_at`, `updated_at` | `timestamptz` | default `now()`; `updated_at` maintained by trigger |

Created by the `handle_new_user()` trigger (`SECURITY DEFINER`, `search_path = ''`), so end users need no INSERT privilege.

### `projects`

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `owner_id` | `uuid` | NOT NULL, FK → `profiles(id)` `ON DELETE CASCADE` |
| `name` | `text` | NOT NULL, `char_length(btrim(name))` 1–120 |
| `description` | `text` | NOT NULL default `''`, ≤ 2000 |
| `status` | `text` | NOT NULL default `'Not Started'`, CHECK in the three allowed values |
| `start_date`, `end_date` | `date` | nullable; CHECK `end_date >= start_date` when both present |
| `created_at`, `updated_at` | `timestamptz` | defaults + trigger |

### `tasks`

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | `uuid` | PK |
| `project_id` | `uuid` | NOT NULL, FK → `projects(id)` `ON DELETE CASCADE` |
| `name` | `text` | NOT NULL, 1–160 trimmed |
| `description` | `text` | NOT NULL default `''`, ≤ 2000 |
| `priority` | `text` | NOT NULL default `'Medium'`, CHECK `Low/Medium/High` |
| `status` | `text` | NOT NULL default `'Pending'`, CHECK `Pending/In Progress/Completed` |
| `due_date` | `date` | nullable |
| `created_at`, `updated_at` | `timestamptz` | defaults + trigger |

**Why CHECK constraints instead of PostgreSQL `ENUM` types?** Adding or renaming an enum value requires `ALTER TYPE` (with transaction restrictions) and makes the schema script harder to re-run; a CHECK is changed with one `ALTER TABLE` and keeps `schema.sql` idempotent. The trade-off: enums are slightly more compact and self-documenting.

**Why no `owner_id` on tasks?** It would duplicate information and could drift (task owner ≠ project owner). Ownership is derived through the project, and RLS checks it with an `EXISTS` on `projects`.

### Normalization
* 3NF: every non-key column depends on the key only; user data in `profiles`, ownership as a foreign key, task facts in `tasks`.
* Aggregates (task counts, dashboard numbers) are **computed**, not stored, so they cannot go out of sync.

## Indexes

| Index | Serves |
|---|---|
| `projects (owner_id, created_at desc)` | default project list, recent projects |
| `projects (owner_id, status)` | status filter, dashboard grouping |
| `tasks (project_id, created_at desc)` | tasks of a project; the FK needs an index (PostgreSQL does not create one automatically) and it speeds cascades |
| `tasks (project_id, status)` | status filter, counts |
| `tasks (due_date) WHERE status <> 'Completed'` | partial index for "upcoming deadlines" |
| `projects/tasks GIN (name gin_trgm_ops)` | `ILIKE '%term%'` name search (pg_trgm) |

## Triggers

* `set_updated_at()` — before UPDATE on all three tables.
* `handle_new_user()` — after INSERT on `auth.users`, creates the profile.

## Views and functions

* `projects_with_stats` — `WITH (security_invoker = true)`: runs with the **caller's** rights, so RLS on `projects` and `tasks` still filters rows. (Without this flag a view runs as its owner and would bypass RLS — a classic pitfall.)
* `get_dashboard_stats()` — SQL function returning `jsonb` with `totalProjects`, `totalTasks`, `projectsByStatus`, `tasksByStatus`. `SECURITY INVOKER`, explicit `owner_id = auth.uid()` filters as a second guard, `EXECUTE` revoked from `anon`.

## Row Level Security policies

RLS is **enabled** on `profiles`, `projects` and `tasks`. `auth.uid()` returns the id from the caller's verified JWT. It is written `(select auth.uid())` so PostgreSQL evaluates it once per query (initplan) rather than once per row.

| Policy | Table | Command | Rule |
|---|---|---|---|
| `profiles_select_own` | profiles | SELECT | `id = auth.uid()` |
| `profiles_update_own` | profiles | UPDATE | USING and WITH CHECK `id = auth.uid()` |
| `projects_select_own` | projects | SELECT | `owner_id = auth.uid()` |
| `projects_insert_own` | projects | INSERT | WITH CHECK `owner_id = auth.uid()` |
| `projects_update_own` | projects | UPDATE | USING + WITH CHECK `owner_id = auth.uid()` (blocks transferring a project) |
| `projects_delete_own` | projects | DELETE | USING `owner_id = auth.uid()` |
| `tasks_select_via_project` | tasks | SELECT | `EXISTS (project p: p.id = tasks.project_id AND p.owner_id = auth.uid())` |
| `tasks_insert_via_project` | tasks | INSERT | WITH CHECK same `EXISTS` (cannot add a task to someone else's project) |
| `tasks_update_via_project` | tasks | UPDATE | USING + WITH CHECK same `EXISTS` (cannot move a task into someone else's project) |
| `tasks_delete_via_project` | tasks | DELETE | USING same `EXISTS` |

All policies are `TO authenticated`. Table privileges for `anon` are revoked as defence in depth.

**How a policy plays out:** with Bob's JWT, `SELECT * FROM projects WHERE id = '<Alice's id>'` returns **zero rows** (the policy silently filters), `UPDATE`/`DELETE` affect **0 rows**, and an `INSERT` that sets `owner_id` to Alice raises *new row violates row-level security policy*. The API maps "0 rows" to `404` and policy errors to `403`.

## Testing the schema

`npm run test:rls` applies the schema twice to a scratch database and runs 32 assertions as two different users (see `tests/sql/rls.test.sql`). `npm run test:integration` additionally exercises the JavaScript data layer through PostgREST.
