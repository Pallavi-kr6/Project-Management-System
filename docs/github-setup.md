# GitHub setup

## Repository name
`project-management-system-web`

## Repository description (pick one, ≤350 chars)
* *Multi-tenant project & task management web app — Next.js, JavaScript, Supabase (Auth + PostgreSQL + Row Level Security), REST API routes, Zod validation, responsive SaaS dashboard.*
* *Full-stack project/task manager with secure per-user data isolation (Supabase RLS), server-side validation and a live dashboard. Next.js 15 + JavaScript + Tailwind.*

## Topics
`nextjs` `javascript` `supabase` `postgresql` `row-level-security` `rest-api` `zod` `tailwindcss` `swr` `project-management` `task-manager` `full-stack`

## Initial commit

```bash
git init
git add .
git status                      # confirm: no .env*, no node_modules, no .next
git commit -m "feat: project management system web app with Next.js, JavaScript and Supabase

- Supabase Auth (email/password) with cookie sessions and protected routes
- REST-style API routes for auth, projects, tasks and dashboard with Zod validation
- PostgreSQL schema with Row Level Security, triggers, stats view and dashboard function
- Responsive dashboard, projects, tasks and profile UI with search, filters and pagination
- Unit, route, SQL (RLS) and PostgREST integration tests
- Documentation: API, database, architecture, interview prep and demo script"
git branch -M main
git remote add origin https://github.com/<your-username>/project-management-system-web.git
git push -u origin main
```

## Before pushing — checklist
- [ ] `git ls-files | grep -E "\.env|node_modules|\.next"` prints nothing except `.env.example`
- [ ] No Supabase keys in code, docs or screenshots
- [ ] Repository visibility is **Public** (the assignment requires viewing without login)
- [ ] README "What has and has not been verified" still matches reality after you test against your own Supabase project
