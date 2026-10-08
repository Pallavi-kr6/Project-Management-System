# 5-minute demo script (web only)

> **Scope statement to say at the start (10 seconds):** "The assignment describes a web app plus a mobile app. For this submission I intentionally built **only the web application**, so this demo shows the web flow end-to-end. The REST API is client-agnostic, so a mobile client could use the same endpoints later."

## Before you record
* Use a **fresh test account** (e.g. `demo@example.test`) — test data only, no personal data.
* Have two browser tabs ready: the **deployed URL** and `localhost` (optional). Close notifications. Zoom to 110%.
* Prepare an empty Supabase project with `schema.sql` applied. Confirm *Confirm email* is OFF (or have the inbox open).
* Keep this script on a second screen. Target length 4:30–5:00.

## Timeline

| Time | Screen | Say | Do |
|---|---|---|---|
| 0:00 | Deployed URL (signed out) | Scope statement above. "Next.js, JavaScript, Supabase Auth + PostgreSQL, Row Level Security." | Open the site; point out the automatic redirect to **/login** (protected routes) |
| 0:20 | Register page | "Registration is validated in the browser **and** again on the server." | Submit weak password → show inline errors. Fill valid data → **Create account** → lands on dashboard |
| 0:50 | Dashboard (empty) | "Everything here comes from the database for *my* user; a new account is all zeros." | Point at the 5 cards and the empty-state call to action |
| 1:05 | Create project | | **New project** → submit empty (validation) → "Website Redesign", status *In Progress*, dates → Create. Toast appears |
| 1:35 | Project details | "Project details with its fields and progress." | Open the project; show start/end/created, progress bar 0% |
| 1:50 | Create tasks | | **Add task** ×3: *Design homepage* (High, due soon), *Write copy* (Low), *Set up analytics* (Medium, due in the past) |
| 2:25 | Edit + status/priority | | Edit *Write copy* → rename. Change **Status** to *In Progress* and **Priority** to *High* using the inline selects. Tick the checkbox on *Design homepage* → "Task completed", progress bar updates to 33% |
| 3:05 | Search/filter | | Search "analytics"; filter Priority = High; filter Status = Completed; clear. Open **Tasks** page → filter by project. Show an empty-result state (search "zzz") |
| 3:35 | Dashboard updates | "No refresh needed — the numbers are recalculated from the DB." | Go to Dashboard: totals, completed 1, pending 1, in-progress breakdown, distribution bars, upcoming deadline shows **Overdue** in red, recent projects |
| 4:00 | Authorization (optional but strong) | "Row Level Security stops one user reading another's data." | In a private window register user B → B's dashboard is empty. (Optionally paste A's project URL → "Project not found") |
| 4:20 | Responsive + dark | | Narrow the window to phone width (or DevTools) → hamburger menu; toggle dark mode |
| 4:35 | Logout / login | "Session lives in an HttpOnly cookie." | **Sign out** → try to open `/dashboard` → redirected to login → sign back in → data is still there |
| 4:50 | Close | "Repo, docs and SQL schema are in GitHub; API docs in `docs/api.md`." | Show the repo README for a few seconds |

## Talking points if time allows
* Server-side validation: `curl` a bad payload and show the `400` JSON (keep a terminal ready).
* Mention tests: unit/route tests, 32 SQL assertions on RLS, integration tests against PostgREST.
* Be honest about limits: in-memory rate limiter, no mobile app (out of scope), no password reset UI.

## Don'ts
* Don't claim the mobile app exists. Don't show real personal data or keys (blur the Supabase dashboard API page).
* Don't say the app is "production-ready" — say "production-style".
