# API reference

Base URL: same origin as the web app (`http://localhost:3000` locally, `https://<your-app>.vercel.app` in production). All endpoints are under `/api`.

## Conventions

| Topic | Rule |
|---|---|
| Format | JSON in, JSON out. Writes require `Content-Type: application/json` (otherwise `415`) |
| Authentication | Session cookies (`sb-<ref>-auth-token…`, **HttpOnly**, `SameSite=Lax`, `Secure` in production) set by `/api/auth/login` or `/api/auth/register`. Send them automatically from the browser (`credentials: "same-origin"`); with curl use `-b/-c cookie.jar` |
| Authorization | Every row is private to its owner. The id of someone else's project/task behaves exactly like a non-existent id → `404` |
| Dates | `YYYY-MM-DD`; must be a real calendar date. `null` clears an optional date |
| IDs | UUIDs. A malformed id → `400 INVALID_ID` |
| Pagination | `page` (≥1, default 1), `pageSize` (1–100, default 10). Lists return `meta: { page, pageSize, total, totalPages }` |
| Sorting | `sort` (whitelisted per resource) and `order` (`asc` \| `desc`, default `desc`) |

### Response envelope

```jsonc
// success
{ "success": true, "data": <payload>, "meta": { ... } /* lists only */ }

// failure
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",          // stable, machine-readable
    "message": "Some fields are invalid", // safe for humans
    "details": [ { "field": "name", "message": "Project name is required" } ] // validation errors only
  }
}
```

### HTTP status codes used

`200` OK · `201` Created · `400` validation / malformed input · `401` not signed in or session expired · `403` forbidden (sign-in blocked, sign-ups disabled) · `404` not found **or not yours** · `409` conflict (duplicate email) · `415` wrong content type · `429` rate limited (`Retry-After` header) · `500` unexpected · `503` Supabase unreachable.

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body/query failed Zod validation; see `details` |
| `INVALID_JSON` | 400 | Body is not valid JSON |
| `INVALID_ID` | 400 | Path id is not a UUID |
| `INVALID_DATE_RANGE` | 400 | `endDate` earlier than `startDate` (DB constraint) |
| `CONSTRAINT_VIOLATION` / `INVALID_INPUT` | 400 | Another DB constraint / format rejection |
| `WEAK_PASSWORD` | 400 | Rejected by Supabase Auth password policy |
| `AUTH_ERROR` | 400 | Any other Supabase Auth failure (message is generic) |
| `UNAUTHORIZED` | 401 | No session |
| `SESSION_EXPIRED` | 401 | Session token invalid/expired |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (deliberately does not say which) |
| `EMAIL_NOT_CONFIRMED` | 403 | Email confirmation is on and the link has not been clicked |
| `SIGNUP_DISABLED` / `FORBIDDEN` | 403 | Sign-ups disabled / RLS denied the write |
| `PROJECT_NOT_FOUND` / `TASK_NOT_FOUND` | 404 | Missing **or** owned by someone else |
| `EMAIL_ALREADY_EXISTS` | 409 | Account exists |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Not `application/json` |
| `RATE_LIMITED` | 429 | Too many auth attempts |
| `INTERNAL_ERROR` / `DATABASE_ERROR` / `CONFIG_ERROR` / `REGISTRATION_FAILED` | 500 | Server-side problem; details only in server logs |
| `SERVICE_UNAVAILABLE` | 503 | Supabase unreachable |

### Object shapes

```jsonc
// Project
{ "id": "uuid", "name": "Website Redesign", "description": "…", "status": "Not Started | In Progress | Completed",
  "startDate": "2026-10-01" /* or null */, "endDate": "2026-11-01" /* or null */,
  "createdAt": "2026-10-07T03:15:46.724838+00:00", "updatedAt": "…", "totalTasks": 3, "completedTasks": 1 }

// Task
{ "id": "uuid", "projectId": "uuid", "name": "Design homepage", "description": "…",
  "priority": "Low | Medium | High", "status": "Pending | In Progress | Completed",
  "dueDate": "2026-10-15" /* or null */, "createdAt": "…", "updatedAt": "…",
  "project": { "id": "uuid", "name": "Website Redesign" } }
```

---

## Authentication

### `POST /api/auth/register` — public

Creates an account. Rate limit: 5 per hour per IP.

Request
```json
{ "fullName": "Alice Test", "email": "alice@example.test", "password": "Passw0rd1" }
```
Rules: `fullName` 1–100 chars (trimmed); `email` valid, ≤254, lower-cased; `password` 8–72 chars with at least one letter and one number.

Response `201`
```json
{ "success": true,
  "data": { "user": { "id": "413ec823-1a37-47ac-a14a-149f318aff6c", "email": "alice@example.test", "fullName": "Alice Test" },
            "requiresEmailConfirmation": false } }
```
If the Supabase project has *Confirm email* enabled, `requiresEmailConfirmation` is `true` and no session is created until the user confirms and logs in.

Errors: `400 VALIDATION_ERROR`, `400 WEAK_PASSWORD`, `409 EMAIL_ALREADY_EXISTS`, `415`, `429 RATE_LIMITED`, `503`.

```json
{ "success": false, "error": { "code": "EMAIL_ALREADY_EXISTS", "message": "An account with this email already exists" } }
```

### `POST /api/auth/login` — public

Rate limit: 10 per 15 minutes per IP.

Request
```json
{ "email": "alice@example.test", "password": "Passw0rd1" }
```
Response `200` (+ `Set-Cookie` session cookies)
```json
{ "success": true, "data": { "user": { "id": "413ec823-…", "email": "alice@example.test", "fullName": "Alice Test" } } }
```
Errors: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_CONFIRMED`, `429 RATE_LIMITED`.

### `POST /api/auth/logout` — public (idempotent)

Clears the session cookies. Response `200`: `{ "success": true, "data": { "loggedOut": true } }`.

### `GET /api/auth/me` — 🔒

Response `200`
```json
{ "success": true,
  "data": { "user": { "id": "413ec823-…", "email": "alice@example.test", "fullName": "Alice Test", "createdAt": "2026-10-07T03:15:46.306928+00:00" } } }
```
Errors: `401 UNAUTHORIZED | SESSION_EXPIRED`, `503`.

---

## Projects 🔒

### `GET /api/projects`

| Query | Type | Notes |
|---|---|---|
| `search` | string ≤100 | Case-insensitive "contains" on name. `%` and `_` are matched literally |
| `status` | `Not Started` \| `In Progress` \| `Completed` | |
| `sort` | `createdAt` (default) \| `name` \| `startDate` \| `endDate` | |
| `order` | `asc` \| `desc` (default) | |
| `page`, `pageSize` | ints | |

`GET /api/projects?status=In%20Progress&search=web&page=1&pageSize=10`

```json
{ "success": true,
  "data": [ { "id": "a0aaddfc-2d07-44a5-8ce9-38cbdb892f8a", "name": "Website Redesign", "description": "Redesign company website",
              "status": "In Progress", "startDate": "2026-10-01", "endDate": "2026-11-01",
              "createdAt": "2026-10-07T03:15:46.724838+00:00", "updatedAt": "2026-10-07T03:15:46.724838+00:00",
              "totalTasks": 3, "completedTasks": 1 } ],
  "meta": { "page": 1, "pageSize": 10, "total": 1, "totalPages": 1 } }
```

### `GET /api/projects/{id}`
Returns one project (same shape). `400 INVALID_ID`, `404 PROJECT_NOT_FOUND`.

### `POST /api/projects`
Request
```json
{ "name": "Website Redesign", "description": "Redesign company website", "status": "Not Started", "startDate": "2026-10-01", "endDate": "2026-11-01" }
```
Only `name` (1–120 chars) is required. Defaults: `description ""`, `status "Not Started"`, dates `null`. The owner is always the signed-in user — an `owner_id` in the body is ignored.

Response `201`: the created project. Validation failure example:
```json
{ "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid",
             "details": [ { "field": "status", "message": "Status must be Not Started, In Progress or Completed" },
                          { "field": "startDate", "message": "Date is not a valid calendar date" } ] } }
```

### `PUT /api/projects/{id}`
Partial update: send any subset of `name`, `description`, `status`, `startDate`, `endDate` (at least one). Omitted fields are untouched; `null` clears a date.
```json
{ "status": "Completed" }
```
Response `200`: the updated project. Errors: `400 VALIDATION_ERROR | INVALID_DATE_RANGE`, `404 PROJECT_NOT_FOUND`.

### `DELETE /api/projects/{id}`
Deletes the project **and all its tasks** (FK cascade). Response `200`: `{ "success": true, "data": { "id": "…" } }`.

---

## Tasks 🔒

### `GET /api/tasks`

| Query | Notes |
|---|---|
| `search` | name contains (case-insensitive) |
| `status` | `Pending` \| `In Progress` \| `Completed` |
| `priority` | `Low` \| `Medium` \| `High` |
| `projectId` | UUID; restrict to one project |
| `sort` / `order` | `createdAt` (default) \| `name` \| `dueDate` ; `asc` \| `desc` |
| `page`, `pageSize` | as above |

Response `200`: `Task[]` (each with embedded `project: { id, name }`) + `meta`.

### `GET /api/tasks/{id}` → `200 Task` · `400 INVALID_ID` · `404 TASK_NOT_FOUND`

### `POST /api/tasks`
```json
{ "projectId": "a0aaddfc-2d07-44a5-8ce9-38cbdb892f8a", "name": "Design homepage", "description": "Hero + navigation",
  "priority": "High", "status": "Pending", "dueDate": "2026-10-15" }
```
`projectId` and `name` (1–160) required. Defaults: `priority "Medium"`, `status "Pending"`, `description ""`, `dueDate null`.

Response `201`
```json
{ "success": true,
  "data": { "id": "45145f5a-ab4f-46dd-afbb-e3eacd2e8249", "projectId": "a0aaddfc-…", "name": "Design homepage", "description": "Hero + navigation",
            "priority": "High", "status": "Pending", "dueDate": "2026-10-15", "createdAt": "2026-10-07T03:15:46.828054+00:00",
            "updatedAt": "2026-10-07T03:15:46.828054+00:00", "project": { "id": "a0aaddfc-…", "name": "Website Redesign" } } }
```
Errors: `400 VALIDATION_ERROR`, `404 PROJECT_NOT_FOUND` (project missing or not yours).

### `PUT /api/tasks/{id}`
Partial update; used for editing, **marking complete** (`{"status":"Completed"}`), changing **status** and **priority**, or moving a task to another project **you own** (`projectId`).
```json
{ "status": "Completed", "priority": "Low" }
```
Errors: `400`, `404 TASK_NOT_FOUND`, `404 PROJECT_NOT_FOUND` (target project not yours).

### `DELETE /api/tasks/{id}` → `200 { "id": "…" }` · `404 TASK_NOT_FOUND`

---

## Dashboard

### `GET /api/dashboard` 🔒

All numbers are computed in PostgreSQL for the signed-in user (`get_dashboard_stats()` + two small queries).

```json
{ "success": true,
  "data": {
    "stats": { "totalProjects": 2, "totalTasks": 3, "completedTasks": 1, "pendingTasks": 1, "inProgressTasks": 1, "projectsInProgress": 1 },
    "taskStatusDistribution": { "Pending": 1, "In Progress": 1, "Completed": 1 },
    "projectStatusDistribution": { "Not Started": 1, "In Progress": 1, "Completed": 0 },
    "upcomingTasks": [ { "id": "…", "name": "Set up analytics", "dueDate": "2020-01-01", "status": "Pending", "priority": "Medium", "project": { "id": "…", "name": "Website Redesign" }, "…": "…" } ],
    "recentProjects": [ { "id": "…", "name": "Mobile Launch", "status": "Not Started", "totalTasks": 0, "completedTasks": 0, "…": "…" } ]
  } }
```
* `pendingTasks` = status exactly `Pending`; `inProgressTasks` is separate (`completed + pending + inProgress = total`).
* `upcomingTasks`: up to 5 non-completed tasks with a due date, soonest first (overdue ones come first).
* `recentProjects`: 5 most recently created.

---

## Try it with curl

```bash
B=http://localhost:3000; J='content-type: application/json'
curl -s -c jar -X POST -H "$J" -d '{"fullName":"Alice Test","email":"alice@example.test","password":"Passw0rd1"}' $B/api/auth/register
curl -s -c jar -X POST -H "$J" -d '{"email":"alice@example.test","password":"Passw0rd1"}' $B/api/auth/login
curl -s -b jar -X POST -H "$J" -d '{"name":"Website Redesign","status":"In Progress"}' $B/api/projects
curl -s -b jar "$B/api/projects?search=web"
curl -s -b jar $B/api/dashboard
```
