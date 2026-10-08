-- =============================================================================
-- Project Management System - Supabase PostgreSQL schema
--
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query.
-- It is idempotent (safe to run again) and contains:
--   1. extensions
--   2. tables  (profiles, projects, tasks)  with constraints and indexes
--   3. triggers (updated_at, auto-create profile on sign-up)
--   4. views / functions (project stats, dashboard stats)
--   5. Row Level Security policies
--   6. grants
--
-- Data ownership model:
--   auth.users 1---1 profiles 1---* projects 1---* tasks
-- A task has no owner column of its own: it is owned by whoever owns its
-- project, and RLS checks that through the projects table.
-- =============================================================================

-- 1. Extensions ---------------------------------------------------------------
-- pg_trgm speeds up case-insensitive "contains" search (ILIKE '%term%').
create extension if not exists pg_trgm with schema extensions;

-- 2. Tables -------------------------------------------------------------------

-- profiles: one row per auth user. Holds app-level data (full name, email copy).
-- Passwords are NEVER stored here; Supabase Auth keeps hashed credentials in
-- auth.users (bcrypt) which the application cannot read.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null
              constraint profiles_full_name_length
              check (char_length(btrim(full_name)) between 1 and 100),
  email       text not null unique
              constraint profiles_email_length check (char_length(email) <= 320),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- projects: each belongs to exactly one profile (the owner).
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null
              constraint projects_name_length
              check (char_length(btrim(name)) between 1 and 120),
  description text not null default ''
              constraint projects_description_length
              check (char_length(description) <= 2000),
  status      text not null default 'Not Started'
              constraint projects_status_check
              check (status in ('Not Started', 'In Progress', 'Completed')),
  start_date  date,
  end_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint projects_date_order
    check (start_date is null or end_date is null or end_date >= start_date)
);

-- tasks: each belongs to exactly one project. Deleting a project deletes its tasks.
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null
              constraint tasks_name_length
              check (char_length(btrim(name)) between 1 and 160),
  description text not null default ''
              constraint tasks_description_length
              check (char_length(description) <= 2000),
  priority    text not null default 'Medium'
              constraint tasks_priority_check
              check (priority in ('Low', 'Medium', 'High')),
  status      text not null default 'Pending'
              constraint tasks_status_check
              check (status in ('Pending', 'In Progress', 'Completed')),
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Indexes (foreign keys are not indexed automatically in PostgreSQL).
create index if not exists projects_owner_created_idx
  on public.projects (owner_id, created_at desc);
create index if not exists projects_owner_status_idx
  on public.projects (owner_id, status);
create index if not exists tasks_project_created_idx
  on public.tasks (project_id, created_at desc);
create index if not exists tasks_project_status_idx
  on public.tasks (project_id, status);
create index if not exists tasks_due_date_idx
  on public.tasks (due_date) where status <> 'Completed';
create index if not exists projects_name_trgm_idx
  on public.projects using gin (name extensions.gin_trgm_ops);
create index if not exists tasks_name_trgm_idx
  on public.tasks using gin (name extensions.gin_trgm_ops);

-- 3. Triggers -----------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- Create a profile automatically whenever someone signs up through Supabase Auth.
-- SECURITY DEFINER lets the trigger insert even though end users have no INSERT
-- policy on profiles. search_path is pinned to avoid search-path hijacking.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
             split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Views and functions ------------------------------------------------------

-- projects + task counts. security_invoker = true makes the view run with the
-- caller's permissions, so the RLS policies on projects/tasks still apply.
create or replace view public.projects_with_stats
with (security_invoker = true) as
select
  p.*,
  count(t.id)                                        as total_tasks,
  count(t.id) filter (where t.status = 'Completed')  as completed_tasks
from public.projects p
left join public.tasks t on t.project_id = p.id
group by p.id;

-- Dashboard aggregates for the CURRENT user in one round trip.
-- SECURITY INVOKER (the default, stated explicitly) + explicit owner filter
-- = RLS and a defensive WHERE clause both scope the numbers to the caller.
create or replace function public.get_dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'totalProjects',
      (select count(*) from public.projects p
        where p.owner_id = (select auth.uid())),
    'totalTasks',
      (select count(*) from public.tasks t
         join public.projects p on p.id = t.project_id
        where p.owner_id = (select auth.uid())),
    'projectsByStatus',
      coalesce((select jsonb_object_agg(s.status, s.n)
                  from (select p.status, count(*) as n
                          from public.projects p
                         where p.owner_id = (select auth.uid())
                         group by p.status) s), '{}'::jsonb),
    'tasksByStatus',
      coalesce((select jsonb_object_agg(s.status, s.n)
                  from (select t.status, count(*) as n
                          from public.tasks t
                          join public.projects p on p.id = t.project_id
                         where p.owner_id = (select auth.uid())
                         group by t.status) s), '{}'::jsonb)
  );
$$;

-- 5. Row Level Security -------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;

-- profiles: a user can read and update only their own row.
-- No INSERT/DELETE policy: rows are created by the trigger and removed by
-- ON DELETE CASCADE when the auth user is deleted.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- projects: full CRUD, but only on rows you own.
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));   -- cannot hand a project to someone else

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- tasks: access is derived from ownership of the parent project.
drop policy if exists "tasks_select_via_project" on public.tasks;
create policy "tasks_select_via_project" on public.tasks
  for select to authenticated
  using (exists (select 1 from public.projects p
                  where p.id = tasks.project_id
                    and p.owner_id = (select auth.uid())));

drop policy if exists "tasks_insert_via_project" on public.tasks;
create policy "tasks_insert_via_project" on public.tasks
  for insert to authenticated
  with check (exists (select 1 from public.projects p
                       where p.id = tasks.project_id
                         and p.owner_id = (select auth.uid())));

drop policy if exists "tasks_update_via_project" on public.tasks;
create policy "tasks_update_via_project" on public.tasks
  for update to authenticated
  using (exists (select 1 from public.projects p
                  where p.id = tasks.project_id
                    and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.projects p      -- cannot move a task into
                       where p.id = tasks.project_id       -- someone else's project
                         and p.owner_id = (select auth.uid())));

drop policy if exists "tasks_delete_via_project" on public.tasks;
create policy "tasks_delete_via_project" on public.tasks
  for delete to authenticated
  using (exists (select 1 from public.projects p
                  where p.id = tasks.project_id
                    and p.owner_id = (select auth.uid())));

-- 6. Grants -------------------------------------------------------------------
-- Defense in depth: the anonymous (not logged in) role gets nothing.
revoke all on public.profiles, public.projects, public.tasks, public.projects_with_stats
  from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects, public.tasks to authenticated;
grant select on public.projects_with_stats to authenticated;

revoke execute on function public.get_dashboard_stats() from public, anon;
grant  execute on function public.get_dashboard_stats() to authenticated;
