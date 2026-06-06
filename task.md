# Coaching App — Progress Log

> Step-by-step record of everything completed in this project so far.
> Backend-only Node.js + Express + MongoDB service. No frontend in scope.

---

## 1. Project setup

- Node 22 + Express 5 + Mongoose 9 backend.
- Originally JavaScript (CommonJS) → migrated to **TypeScript strict mode + ESM** (commit `af7d7ae`).
- Git repository on branch `dev`; `main` is the integration branch.
- Phase 1 (scaffolding) is shipped; Phase 2 is in progress: 2.1 (four-role auth) ✅, 2.1.1 (generic email-conflict) ✅, 2.4 (teacher reviews ✅ + center-review routes ✅), 2.7 (per-role profiles) ✅, Subject CRUD (2.2 partial) ✅, CoachingCenter CRUD (2.2) ✅, student search (2.5 partial) ✅, student bookmarks ✅ (enriched response ✅), owner dashboard ✅. **Owner-dashboard write APIs all shipped** ✅ — every dashboard metric is now driven by real API activity: profile-view recording, center reviews, enquiry creation, owner-managed enrollments. Still open: Courses/assignments (2.3), admin center moderation, full search, owner-side enquiry management.

---

## 2. Folder structure

```
Coaching-app/
├── src/
│   ├── app.ts                         # Express app (middleware, route mounts)
│   ├── server.ts                      # boot + graceful shutdown
│   ├── config/
│   │   ├── index.ts                   # env config (fail-fast on JWT_SECRET)
│   │   └── db.ts                      # Mongoose connection
│   ├── controllers/
│   │   ├── auth.controller.ts         # register / login / refresh / logout / me
│   │   ├── owners.controller.ts       # self PATCH / DELETE / password
│   │   ├── teachers.controller.ts     # self + public GET /api/teachers/:id
│   │   ├── students.controller.ts     # self
│   │   ├── admins.controller.ts       # self
│   │   ├── dashboard.controller.ts    # student dashboard + owner-center dashboard
│   │   ├── centers.controller.ts      # CoachingCenter CRUD (public reads + owner writes)
│   │   ├── subjects.controller.ts     # public list + GET /api/subjects/:id
│   │   ├── search.controller.ts       # student search: teachers + centers
│   │   ├── bookmarks.controller.ts    # student bookmarks: create/list/delete (enriched student+target response)
│   │   └── admin/                     # /api/admin/* moderation surface
│   │       ├── owners.admin.controller.ts
│   │       ├── teachers.admin.controller.ts
│   │       ├── students.admin.controller.ts
│   │       ├── admins.admin.controller.ts
│   │       └── subjects.admin.controller.ts
│   ├── schemas/                       # Zod request schemas
│   │   ├── common.ts                  # objectId, location, pagination, password-change
│   │   ├── owners.schemas.ts
│   │   ├── teachers.schemas.ts
│   │   ├── students.schemas.ts
│   │   ├── admins.schemas.ts
│   │   ├── subjects.schemas.ts
│   │   ├── centers.schemas.ts         # center create/update/list (nested fees/timings/classRange refines)
│   │   ├── search.schemas.ts          # teacher/center search query schemas (geo pair refine)
│   │   └── bookmarks.schemas.ts       # bookmark create + list-query (target-type enum)
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── passwordHook.ts        # bcrypt pre-save + comparePassword
│   │   │   ├── jwt.ts                 # issueAccess/issueRefresh + verifyAccess/verifyRefresh
│   │   │   ├── refreshTokens.ts       # Redis whitelist + family rotation + revokeAllForUser
│   │   │   ├── cookies.ts             # refresh-cookie helpers (set / clear / options)
│   │   │   ├── sanitize.ts            # strip password/__v from any role doc
│   │   │   └── emailUniqueness.ts     # cross-collection email check + EmailConflictError (generic 409, no role leak)
│   │   ├── authz/                     # (empty — Phase 2.3)
│   │   ├── crud/                      # CRUD helpers
│   │   │   ├── projectTeacherPublic.ts  # public-safe teacher projection (accepts doc OR lean obj)
│   │   │   ├── projectCenterPublic.ts   # public-safe center projection (search results)
│   │   │   ├── resolveSubjectIds.ts     # subject id-or-name/slug → Subject ObjectIds
│   │   │   └── escapeRegex.ts         # safe text-search regex escaping
│   │   ├── dashboard/                 # owner-dashboard aggregation helpers
│   │   │   └── ownerDashboard.queries.ts # 7-day window + profile-view/enrollment/enquiry pipelines
│   │   ├── logger.ts                  # pino singleton + httpLogger (pino-http)
│   │   └── redis.ts                   # ioredis singleton + connect/disconnect
│   ├── middleware/
│   │   ├── asyncHandler.ts
│   │   ├── errorHandler.ts
│   │   ├── notFound.ts
│   │   ├── protect.ts                 # Bearer → req.auth
│   │   ├── requireRole.ts             # role gate
│   │   └── validate.ts                # Zod factory (body/query/params)
│   ├── models/
│   │   ├── Admin.ts
│   │   ├── CoachingCenter.ts          # owner ref → 'Owner'
│   │   ├── CoachingCenterReview.ts    # student→center rating (was Review.ts; collection pinned 'reviews')
│   │   ├── StudentBookmark.ts         # polymorphic refPath: student saves Teacher/Webinar/CoachingCenter
│   │   ├── ProfileView.ts             # per-view event for a CoachingCenter (powers owner dashboard graph)
│   │   ├── Enrollment.ts              # student↔center link, status active/completed/cancelled/expired
│   │   ├── Enquiry.ts                 # student ref → 'Student'
│   │   ├── Owner.ts
│   │   ├── Student.ts
│   │   ├── Subject.ts
│   │   ├── Teacher.ts
│   │   ├── TeacherReview.ts           # student→teacher rating (denormalises onto Teacher)
│   │   └── Webinar.ts                 # teacher-hosted webinars (dashboard "upcoming")
│   ├── routes/
│   │   ├── auth.routes.ts             # /api/auth/{register,login,refresh,logout,me}
│   │   ├── owners.routes.ts           # /api/owners/me (PATCH/DELETE/password)
│   │   ├── teachers.routes.ts         # /api/teachers/{me, :id}
│   │   ├── students.routes.ts         # /api/students/me
│   │   ├── centers.routes.ts          # /api/centers (public reads + owner CRUD)
│   │   ├── admins.routes.ts           # /api/admins/me
│   │   ├── subjects.routes.ts         # /api/subjects (public list + :id)
│   │   ├── search.routes.ts           # /api/search?searchType=teacher|coaching|webinar (student-only)
│   │   ├── admin.routes.ts            # /api/admin/* moderation (+ /subjects writes)
│   │   └── health.routes.ts           # /api/health
│   ├── scripts/
│   │   └── seedAdmin.ts               # bootstrap first admin
│   ├── types/
│   │   ├── express.d.ts               # Request.auth augmentation
│   │   └── dashboard.ts               # owner-dashboard response types
│   └── utils/
│       └── ApiError.ts                # HTTP-aware operational error + optional `body` for fixed response shapes
├── decisions/                          # ADR-0001 … ADR-0004
├── docs/superpowers/{specs,plans}/    # Phase 1 design + plan
├── Dockerfile                          # multi-stage (builder + runtime)
├── docker-compose.yml                  # app + mongo + redis
├── .dockerignore
├── .env / .env.example
├── package.json
├── tsconfig.json
├── Task.md                             # Phase checkbox tracker
├── task.md                             # this progress log
└── README.md
```

---

## 3. Packages installed

### Runtime dependencies
- `express` ^5.2.1
- `mongoose` ^9.6.2
- `cors` ^2.8.6
- `dotenv` ^17.4.2
- `bcryptjs` ^3.0.3       *(Phase 2)*
- `jsonwebtoken` ^9.0.3   *(Phase 2)*
- `pino` ^10.3.1          *(logging)*
- `pino-http` ^11.0.0     *(logging)*
- `ioredis` ^5.10.1       *(refresh-token store)*
- `cookie-parser` ^1.4.7  *(refresh cookie reads)*
- `zod` ^4.4.3            *(request validation)*

### Dev dependencies
- `typescript` ^6.0.3
- `tsx` ^4.22.3
- `@types/node` ^25.9.1
- `@types/express` ^5.0.6
- `@types/cors` ^2.8.19
- `@types/bcryptjs` ^2.4.6    *(Phase 2)*
- `@types/jsonwebtoken` ^9.0.10 *(Phase 2)*
- `pino-pretty` ^13.1.3       *(logging, dev-only pretty-print)*
- `@types/cookie-parser` ^1.4.10  *(refresh cookie types)*

`nodemon` was removed during the TS migration (replaced by `tsx watch`).

---

## 4. Configuration changes

### `tsconfig.json`
- `strict: true` + every strict sub-flag
- `target: ES2023`, `module: NodeNext`, `moduleResolution: NodeNext`
- `rootDir: src`, `outDir: dist`
- `noUnusedLocals` / `noUnusedParameters` on
- `allowJs: false`, `declaration: false` (this is an app, not a library)
- `noUncheckedIndexedAccess: false` (flip later when request validation lands)

### `package.json` scripts
- `dev`          — `tsx watch src/server.ts`
- `build`        — `tsc`
- `start`        — `node dist/server.js`
- `typecheck`    — `tsc --noEmit`
- `clean`        — `rm -rf dist`
- `seed:admin`   — `tsx src/scripts/seedAdmin.ts`
- `seed:webinars`— `tsx src/scripts/seedWebinars.ts`
- `seed:demo`    — `tsx src/scripts/seedDemo.ts` *(full demo dataset — wipe & reseed all collections; every API returns real data)*

### `src/config/index.ts`
- Reads `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN` from env.
- **Fail-fast** at boot if `JWT_SECRET` is missing (Phase 2).

### `.env.example`
- Server: `NODE_ENV`, `PORT`
- DB: `MONGO_URI`
- Auth (access): `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN` *(default 15m)*
- Auth (refresh): `JWT_REFRESH_SECRET` *(must differ from `JWT_SECRET`)*, `JWT_REFRESH_EXPIRES_IN` *(default 7d)*
- Redis: `REDIS_URL` *(default `redis://127.0.0.1:6379`; compose overrides to `redis://redis:6379`)*
- Cookie: `COOKIE_DOMAIN` *(optional — leave unset for same-origin only)*
- CORS: `CORS_ORIGIN`
- Admin seeder: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` *(Phase 2)*
- Logging: `LOG_LEVEL` (trace|debug|info|warn|error|fatal; defaults to `info` in prod, `debug` otherwise)

### Module system
- `"type": "module"` (ESM throughout)
- Relative imports must use `.js` extension even when source is `.ts`

---

## 5. Features implemented

### Phase 1 — Scaffolding & schemas (shipped)
- Central env config + Mongo connection helper
- `ApiError` class (HTTP-aware operational errors)
- Express app + 404 handler + central error handler
- `/api/health` route — uptime + env + timestamp
- Graceful shutdown on `SIGINT` / `SIGTERM`
- Five schemas: `User` (later replaced), `Subject`, `CoachingCenter`, `Review`, `Enquiry`
- Geo (2dsphere) + text + compound indexes on `CoachingCenter`
- Slug auto-generation on `CoachingCenter` and `Subject`
- Denormalised `averageRating` + `totalReviews` on `CoachingCenter` via `Review` post-hooks
- ADRs 0001 (GeoJSON), 0002 (Subject as separate collection), 0003 (one owner → many centers), 0004 (denormalised rating)

### TypeScript migration (shipped, commit `af7d7ae`)
- All 13 `.js` files renamed via `git mv` → `.ts`
- CommonJS → ESM (`import`/`export`, `import 'dotenv/config'`)
- Mongoose typing pattern: `InferSchemaType<typeof schema>` + `HydratedDocument<T>` + `Model<T>`
- Express middleware typed via `RequestHandler` / `ErrorRequestHandler`
- Dockerfile rewritten as multi-stage (builder → runtime)
- `tsx watch` for dev, `tsc` build + `node dist/server.js` for prod

### Full CRUD for Owner / Teacher / Student / Admin (shipped)
- **Three slices**: self-management (every authenticated user), admin moderation namespace `/api/admin/*`, and a public teacher profile `GET /api/teachers/:id`.
- **Validation**: Zod schemas (`src/schemas/*.schemas.ts`) — one schema per operation, `.strict()` rejects unknown keys (the main defense against privilege-escalation injection like `{"isActive":false}` on a self-PATCH). Field-path errors bubble up via `validate` middleware → `ApiError(400)`.
- **Self endpoints** (per role): `PATCH /api/{role}/me` (whitelisted fields), `DELETE /api/{role}/me` (soft-deactivate + revoke all sessions), `POST /api/{role}/me/password` (verifies current password, re-hashes, **revokes all sessions**, re-issues tokens for the calling device).
- **Admin moderation** (`protect` + `requireRole('admin')`):
  - Per role: `GET /api/admin/{role}` (pagination + filters: `q`, `city`, `isActive`, `isEmailVerified`, + `isVerified` on teachers), `GET /:id`, `PATCH /:id`, `PATCH /:id/deactivate`, `PATCH /:id/activate`
  - `POST /api/admin/admins` bootstraps a successor admin (cross-collection email check, `createdBy` set, no auto-login)
  - **Anti-lockout guards**: admins cannot deactivate themselves or change their own `permissions[]`/`isActive` via the admin namespace; both → 403
- **Public teacher**: `GET /api/teachers/:id` — allow-list projection (no `email`/`phone`/`password`), 404 on `isActive=false` so deactivated accounts don't leak existence.
- **Per-user refresh revocation**: refactored `src/lib/auth/refreshTokens.ts` with a `rt:user:<sub>:families` set index; new `revokeAllForUser(sub)` called on password change, self-delete, and admin deactivate. Active sessions for the user are killed on the spot — verified end-to-end with two simulated devices.
- **Mongoose `.save()` runs validators**: PATCH handlers use `Object.assign(doc, updates).save()` so model-level constraints (enums, min/max, regex) fire on every edit. Zod is the first line of defense; Mongoose is the safety net.
- **Verified end-to-end**: self-PATCH happy paths for all four roles, `.strict()` rejection (`isActive`/`email` unknown-key 400s), password change kicks Device B's refresh + lets Device A continue, self-delete locks user out across access + refresh, public teacher returns clean projection (no email/phone), admin list with pagination/filters, admin deactivate revokes target user's sessions, admin self-deactivate → 403, admin self-permissions-edit → 403, successor admin creation with custom permissions, validation error `feesRange.min: Too small...` surfaced cleanly.

### Refresh tokens + Redis-backed rotation (shipped)
- **Two-token model**: short-lived access JWT (`15m`, in JSON body) + long-lived refresh JWT (`7d`, returned **both** in the JSON body as `refreshToken` and as an HTTP-only secure cookie scoped to `/api/auth`). Browser clients keep using the cookie; mobile/CLI clients can read the body value.
- **Separate secrets** — `JWT_SECRET` (access) and `JWT_REFRESH_SECRET` (refresh) are required at boot and must differ. Limits blast radius if one secret leaks.
- **Redis whitelist** (`ioredis`) with two key families:
  - `rt:jti:<jti>` → `<familyId>` (TTL = refresh expiry)
  - `rt:family:<familyId>` → Set of active JTIs (TTL = refresh expiry)
- **Rotation**: every `/api/auth/refresh` call atomically `DEL`s the presented JTI and issues a new one in the same family. The `DEL → returned 1?` check makes rotation single-use and concurrency-safe.
- **Reuse detection**: if a presented JTI is missing (already rotated / logged out / **stolen and replayed**), the entire family is revoked via `SMEMBERS` + bulk `DEL`. The legitimate user is forced to re-login. Logged at WARN with `{jti, family, sub}`.
- **Cookie attributes**: `httpOnly`, `sameSite=strict`, `secure` in prod, `path=/api/auth`, `maxAge=7d`. JS in the browser cannot read it; CSRF surface is minimised by `SameSite=Strict` + path scope.
- **Endpoints**:
  - `POST /api/auth/register` — issues access + refresh; returns `{success, accessToken, refreshToken, user}` and sets refresh cookie
  - `POST /api/auth/login` — issues access + refresh; returns `{success, accessToken, refreshToken, user}` and sets refresh cookie
  - `POST /api/auth/refresh` — reads cookie, rotates, returns `{success, accessToken, refreshToken}` (rotated value), sets new cookie
  - `POST /api/auth/logout` — revokes current refresh JTI, clears cookie (204; no body)
- **Standard response envelope**: every token-issuing handler (auth + 4 role `changePassword`) returns `{success: true, accessToken, refreshToken, user?}`. `user` is omitted on `/api/auth/refresh` and on password change. `GET /api/auth/me` returns `{success: true, userType, user}`. Defined as `AuthTokenResponse` / `AuthIdentityResponse` in `src/types/auth-response.ts`.
- **Verified end-to-end**: registration → cookie set → `/me` with access → rotation (JTI changes) → replay of old JTI → 401 + family revoked → new JTI also rejected → logout clears cookie → Redis returns 0 leftover `rt:*` keys.

### Structured logging (shipped)
- `pino` + `pino-http` + `pino-pretty` (dev-only) — JSON logs in prod, pretty-printed in dev
- Singleton logger at `src/lib/logger.ts` with `redact` paths (auth headers, cookies, `*.password|*.token|*.jwt`, etc., `remove: true`)
- `httpLogger` mounted in `app.ts` after CORS + JSON, before routes — auto request-ID correlation, `customLogLevel` (5xx→error, 4xx→warn, else info), `/api/health` skipped
- `errorHandler` now logs every error with `{err, statusCode, path, method, reqId}` — was silent on 500s before
- All 9 ad-hoc `console.*` calls in `server.ts` / `config/db.ts` / `scripts/seedAdmin.ts` replaced with structured logger calls
- `LOG_LEVEL` env knob threaded through `src/config/index.ts`
- Verified end-to-end: redaction (`grep -c hunter2 = 0`), reqId correlation across pino-http + errorHandler lines, prod JSON parses with `jq`, SIGTERM logs `shutdown signal received` → `mongo disconnected`

### Phase 2.1 — Four-role auth foundations (complete)
- Single `User` collection dropped; replaced by four role collections: `Owner`, `Teacher`, `Student`, `Admin`
- Shared bcrypt pre-save hook + `comparePassword` instance method via `attachPasswordHooks<T>(schema)` factory
- JWT helper (`issue` / `verify`) with `{sub, userType}` payload
- Cross-collection email uniqueness check (`isEmailTaken` / `assertEmailAvailable` — generic 409 envelope, role never disclosed; see Phase 2.1.1 below)
- `protect` middleware decodes Bearer token and loads the user from the correct collection
- `requireRole(...allowed)` middleware
- `asyncHandler` wrapper for promise-rejecting route handlers
- Express `Request.auth` type augmentation (tagged union)
- Admin bootstrap via `npm run seed:admin` (env-driven)
- All existing model refs updated:
  - `CoachingCenter.owner` → `Owner` (was `User`)
  - `Review.student`       → `Student` (was `User`)
  - `Enquiry.student`      → `Student` (was `User`)

### Student Dashboard + Webinars + Teacher reviews (shipped)
- **Aggregated dashboard** — `GET /api/students/dashboard` (`protect` + `requireRole('student')`) returns `{success, dashboard: {topTeachers, topCenters, upcomingWebinars}}` in one round-trip. Read-only; every field is public-safe (no email/phone/password — verified via key allow-list).
  - **topTeachers** — top 5 by `averageRating` desc, `totalReviews` tiebreak. Each: `{_id, name, profileImage, subjects: [name…], averageRating, totalReviews}` (`subjects` populated from `Subject`).
  - **topCenters** — top 3 by `averageRating` desc. Each: `{_id, name, image (=profileImage), averageRating, totalReviews, city, area}`.
  - **upcomingWebinars** — webinars with `status:'scheduled'` and `scheduledAt` in `[now, now+48h]`, **ranked by the hosting teacher's `totalReviews` desc → `averageRating` → soonest, capped at top 3**. Each: `{_id, title, teacher:{name, profileImage, totalReviews}, scheduledAt, thumbnail, joinUrl}`.
  - **Gotcha fixed**: dashboard does a side-effect `import '../models/Subject.js'` so `Teacher.populate('subjects')` works even though no Subject route is mounted yet (Phase 2.2). Without it the model isn't registered → `MissingSchemaError`.
- **New `Webinar` model** (`src/models/Webinar.ts`) — `{title, teacher→Teacher, description, scheduledAt, durationMinutes, thumbnail, joinUrl, status('scheduled'|'live'|'completed'|'cancelled'), isActive}`; indexes `scheduledAt`, `(status, scheduledAt)`, `(teacher, scheduledAt)`. Soft-delete via `isActive`.
- **Webinar full CRUD** (`/api/webinars`) — public `GET /` (pagination + `teacher`/`status`/`upcoming` filters, teacher populated) and `GET /:id`; teacher-authored `POST /` (teacher taken from `req.auth`, never body), `PATCH /:id`, `DELETE /:id` (soft-delete). Owner-only guard (403 on others' webinars), Zod `.strict()` schemas, `seedWebinars.ts` fixture (2 in-window + 1 out-of-window to prove filtering).
- **New `TeacherReview` model** (`src/models/TeacherReview.ts`) — mirrors the center-review pattern: `{teacher→Teacher, student→Student, rating(1–5), comment, isEdited}`, unique `(teacher, student)`, `recalcStats` static + `post('save'|'findOneAndUpdate'|'findOneAndDelete')` hooks that denormalise `averageRating`/`totalReviews` **onto `Teacher`**. This is what makes "Top Rated Teachers" rank by real ratings instead of zeros (closes the Phase 2.4 teacher-rating gap).
- **Teacher-review API** — public `GET /api/teachers/:id/reviews` (paginated, `student` populated); student-authored `POST /api/teachers/:id/reviews` (404 if teacher missing/inactive, 409 on duplicate); author-only `PATCH`/`DELETE /api/teacher-reviews/:id` (sets `isEdited`, recalcs on every write).
- **`Review` → `CoachingCenterReview` rename** — `src/models/Review.ts` renamed (via `git mv`) to `src/models/CoachingCenterReview.ts`; registered model name, exported var, and `*Attrs/*Doc/*Model` types all renamed. **Collection pinned to `'reviews'`** so existing documents aren't orphaned. Now symmetric with `TeacherReview` (center reviews still live in `reviews`; teacher reviews in `teacherreviews`).
- **Verified end-to-end** (live Docker stack): dashboard returns 5/≤3/≤3 sections with no PII leak; no-token→401, non-student→403; webinar CRUD 201/200/403/400/204/404 with owner guard + `.strict()` rejection; teacher-review create→`{avg:3,n:2}`, edit→`{avg:1.5,n:2}`, delete→`{avg:2,n:1}` denormalised onto Teacher and reflected on the dashboard; webinar ranking surfaces the highest-`totalReviews` hosts' webinars first (`[4,3,2]` top-3). `tsc --noEmit` clean throughout.

### Phase 2.2 (partial) — Subject CRUD: public reads + admin writes (shipped)
- **Surface**: public reads, admin-only writes, **no delete** (hide via `isActive` toggle instead).
  - Public (`/api/subjects`): `GET /` (list, active only, pagination + `q`/`category` filters) and `GET /:id` (active only; 404 if missing or `isActive=false` so deactivated subjects don't leak).
  - Admin (`/api/admin/subjects`, `protect` + `requireRole('admin')`): `GET /` (lists **all** incl. inactive, adds `isActive` filter — so admins can find/reactivate hidden subjects the public list omits), `GET /:id`, `POST /` (create), `PATCH /:id` (update incl. `isActive`).
- **Schemas** (`src/schemas/subjects.schemas.ts`) — `.strict()` create/patch/list query schemas. `slug` is intentionally **absent** from every request schema (auto-derived by the model's `pre('validate')` hook), so clients can't set/forge it.
- **Duplicate handling** — `name` (+ derived `slug`) are unique; create/update catch Mongo `E11000` locally and reshape to `409 'Subject already exists'` (the global handler's E11000 reshape only covers the `email` index).
- **Files**: new `src/schemas/subjects.schemas.ts`, `src/controllers/subjects.controller.ts` (public), `src/controllers/admin/subjects.admin.controller.ts` (admin); edited `src/routes/admin.routes.ts` (+`/subjects` block), new `src/routes/subjects.routes.ts`, mounted `/api/subjects` in `src/app.ts`. No model change (`Subject` already existed).
- **Verified end-to-end** (live Docker stack): create → `201` + auto-slug `mathematics`; duplicate name → `409`; unknown key (`slug`) → `400` via `.strict()`; public list/get → `200`; after admin `isActive=false` PATCH, public get → `404` while admin `?isActive=false` list still returns it; write with no token → `401`. `tsc --noEmit` clean.

### Student bookmarks — save Teachers / Webinars / Coaching Centers (shipped)
- **One polymorphic model** `StudentBookmark` (`src/models/StudentBookmark.ts`) — `{ student→Student, targetType ('Teacher'|'Webinar'|'CoachingCenter'), target }` where `target` uses Mongoose **`refPath: 'targetType'`** to resolve to the right collection on populate (first `refPath` use in the repo). Unique index `(student, targetType, target)` → idempotent saves; secondary `(student, createdAt)` for listing.
- **Student-only API** (`protect` + `requireRole('student')`), mounted on the existing students router:
  - `POST /api/students/bookmarks` — body `{ targetType, targetId }`. Verifies the target exists & `isActive` (404 otherwise), 409 on duplicate (E11000). → `201 { success, bookmark }`.
  - `GET /api/students/bookmarks` — caller's bookmarks, newest-first, `?targetType=&page=&limit=`. `target` populated via a **union allow-list `select`** (covers all three types, deliberately omits teacher/center `email`/`phone`). → `{ success, data, pagination }`.
  - `DELETE /api/students/bookmarks/:id` — ownership-checked (403 on others'), 404 if missing. → `204`.
- **Files**: new `src/models/StudentBookmark.ts`, `src/schemas/bookmarks.schemas.ts`, `src/controllers/bookmarks.controller.ts`; edited `src/routes/students.routes.ts` (+`/bookmarks` block). No `app.ts` change (students router already mounted).
- **Out of scope** (not requested): unsave-by-target toggle, `isBookmarked` check endpoint, cascade-cleanup when a target is later deleted (a dangling bookmark just populates `target: null`).
- **Enriched response (shipped)** — `GET`/`POST` bookmark responses now embed, **inside each item**, the **full caller's student** (own-profile view — `email`/`phone` kept, `password`/`__v` stripped via `populate('student','-__v')` + `select:false`) and the **fully-projected target** run through the existing per-type helpers (`projectTeacherPublic`/`projectCenterPublic`/`projectWebinarPublic`). The old partial `TARGET_SELECT` was dropped. `projectTeacherPublic` was made lean-friendly (accepts a hydrated doc **or** a plain object) so it composes with the `.lean()` bookmark query without breaking its existing doc-passing callers. Verified live: teacher/webinar targets leak no `email`/`phone`/`owner`/`isActive`; center target keeps contact (business listing, by design); student has no `password`/`__v`; `?targetType=` filter + regression on `/api/teachers/:id` & `/api/search` all green. Commit `d04f30e` on `dev`.
- **Verified end-to-end** (live Docker stack): no-token → `401`, teacher token → `403`; create teacher + webinar bookmark → `201`; duplicate → `409`; nonexistent target → `404`; invalid `targetType` enum + unknown key → `400`; list returns both with `target` populated and **no email/phone leak**; `?targetType=` filter works; delete by id → `204`, repeat → `404`; a second student deleting the first's bookmark → `403`. `tsc --noEmit` clean.

### Phase 2.2 — CoachingCenter CRUD: public reads + owner writes (shipped)
- **Surface**: public reads, **owner-authored** writes (one owner = one center), soft-delete (no hard delete). Base `/api/centers`. No model change — `CoachingCenter` already existed with slug auto-gen, geo, and denormalised rating.
- **Endpoints**:
  - Public `GET /api/centers` — active centers only, pagination + filters (`q` regex on `name`/`description`/`area`, `city`, `board`, `isVerified`), sorted `averageRating desc → totalReviews desc`, `subjectsOffered` populated (`name`,`slug`), **public projection** (`owner`/`isActive`/`__v` hidden via `projectCenterPublic`).
  - Public `GET /api/centers/:id` — single active center (404 if missing or `isActive=false` so soft-deleted centers don't leak), same projection.
  - Owner `POST /api/centers` (`protect`+`requireRole('owner')`) — `owner` taken from the token (never body); **409 if the owner already has a center**; `slug` auto-derived; `.strict()` rejects server-controlled fields (`owner`/`slug`/`isActive`/`isVerified`/`averageRating`/`totalReviews`). 201 `{ center }` (full doc — it's the owner's own).
  - Owner `GET /api/centers/me` — the caller's own center in any state (registered before `/:id` so `me` isn't parsed as an ObjectId). 404 if none.
  - Owner `PATCH /api/centers/:id` — owner-only edit (403 on others'); `Object.assign + save()` re-runs validators and re-slugs on name/city change; E11000 → 409.
  - Owner `DELETE /api/centers/:id` — owner-only soft-delete (`isActive=false`), 403 on others', 204.
- **Schemas** (`src/schemas/centers.schemas.ts`) — `.strict()` create/update/list-query; nested `classRange`/`fees` carry `.refine()` (from≤to, min≤max); `timings[]` items validate `day` enum + `HH:mm`; `centerUpdateSchema = z.object(centerFields).partial().strict()`. Reuses `locationSchema`/`objectIdSchema`/`phoneSchema`/`profileImageSchema`/`paginationFields` from `common.ts`.
- **Files**: new `src/schemas/centers.schemas.ts`, `src/controllers/centers.controller.ts`, `src/routes/centers.routes.ts`; mounted `/api/centers` in `src/app.ts`. Reuses existing `projectCenterPublic` + `escapeRegex`.
- **Out of scope (deferred)**: admin center moderation (list/verify/activate — Phase 2.6), center-review HTTP routes (Phase 2.4), `area` filter in unified search.
- **Verified end-to-end** (live Docker stack): public list hides `owner`/`isActive` and populates subjects; public get works; fresh owner `GET /me` → 404 then `POST` → 201 with auto-slug (`test-tutorials-kolkata-7fcw`) + owner set + `isActive:true`; **duplicate create → 409**; PATCH own → 200 (fields updated); PATCH another owner's center → 403; unknown key (`isVerified`) → 400 via `.strict()`; create missing `address` → 400; no-token POST → 401, student POST → 403; DELETE own → 204, public GET after → 404 while owner `GET /me` still 200 (sees own inactive center). `tsc --noEmit` clean.

### Owner Coaching-Center Dashboard (shipped)
- **Surface**: `GET /api/owners/dashboard` (`protect` + `requireRole('owner')`) — one round-trip returning six metric sections for the **calling owner's coaching center**. Assumes **one owner = one center**; the center is auto-resolved via `CoachingCenter.findOne({ owner })` (→ `404 "No coaching center found for this owner"` if none). Response envelope `{ success: true, data: {…} }`.
- **Sections**:
  - `weeklyProfileViews` (number) — total profile views over today + previous 6 days.
  - `weeklyEnquiries` (number) — enquiries `createdAt` in the same 7-day window.
  - `averageRating` / `totalReviews` — **reused from the denormalised `CoachingCenter` fields** (zero extra query).
  - `activeStudents` (number) — **distinct** students with an `Enrollment` of `status:'active'` (via `$addToSet`).
  - `profileViewStats` (`[{date:'YYYY-MM-DD', views}]`) — **always 7 entries, ascending, zero-filled** for empty days.
  - `recentEnquiries` (≤5, newest-first) — `{enquiryId, studentName, phone, email, message, createdAt}` with student contact populated from the `Student` ref (owner's own list).
- **New models**: `ProfileView` (`{coachingCenter, viewer?, viewedAt}`, one doc per view, index `(coachingCenter, viewedAt)`) and `Enrollment` (`{coachingCenter, student, status, subject?, enrolledAt, endedAt?}`, statuses `active|completed|cancelled|expired`, non-unique index `(coachingCenter, status, student)`).
- **Efficiency**: 1 center lookup, then **4 parallel** queries via `Promise.all`. Sections #1 + #5 come from **one** `ProfileView` aggregation (`$dateToString` group, JS zero-fill). All aggregation/date logic lives in `src/lib/dashboard/ownerDashboard.queries.ts`; a single `DASHBOARD_TZ` constant (default `'UTC'`) drives both the JS window boundaries and the `$dateToString` timezone so buckets align. Architecture is flat (controller → Mongoose), matching the rest of the repo — no service/repository layer.
- **Files**: new `src/models/ProfileView.ts`, `src/models/Enrollment.ts`, `src/types/dashboard.ts`, `src/lib/dashboard/ownerDashboard.queries.ts`; edited `src/controllers/dashboard.controller.ts` (+`getOwnerDashboard`), `src/routes/owners.routes.ts` (+route), `src/scripts/seedDemo.ts` (+ProfileView/Enrollment seed, owners bumped 4→5 for 1:1 center mapping).
- **Verified end-to-end** (live Docker stack, today=2026-06-04): window `2026-05-29 … 2026-06-04`; `weeklyProfileViews` 58 = sum of stats; `profileViewStats` has exactly 7 ascending entries with `2026-05-30` zero-filled; `activeStudents` 3 (distinct active only); `recentEnquiries` ≤5 newest-first with contact; no-token → `401`, student token → `403`, owner-without-center → `404`; per-owner isolation (owner1=58 vs owner2=64, distinct ratings/enquiries). `tsc --noEmit` clean.

### Phase 2.5 (partial) — Student search for Teachers, Centers & Webinars (shipped)
- **Surface**: **student-only** (`protect` + `requireRole('student')`) — a single unified endpoint `GET /api/search?searchType=teacher|coaching|webinar`. Built ahead of the full CoachingCenter CRUD (Phase 2.2 still pending) without depending on it.
- **`searchType` dispatch** — a required `searchType` query param picks the entity (validated **first**; unknown/missing → `400 "searchType must be one of: teacher, coaching, webinar"`). Then the query is parsed against the matching per-type Zod schema and routed to the right handler. **Manual dispatch, not `z.discriminatedUnion`** — the teacher/center schemas carry a `.refine()` (geo-pair rule) so they're `ZodEffects`, which a discriminated union can't take as branches. The error-reshape logic was extracted from the `validate` middleware into a shared `parseOrThrow(schema, data, source)` so the unified controller emits byte-identical `400`s. The old `/api/search/teachers` + `/api/search/centers` sub-routes were **retired** (logic folded into the run-* helpers).
- **Webinar search (new)** — `searchType=webinar`: `q` (regex on `title`/`description`), `status` (enum), `upcoming` (`scheduledAt ≥ now`), `teacher` (id). Sorted `scheduledAt` asc (soonest first), `isActive:true`, teacher populated (`name`,`profileImage`). Public projection extracted to `src/lib/crud/projectWebinarPublic.ts` (shared with the webinars list/detail controller).
- **Combined feed (no `searchType`)** — `GET /api/search` with no/empty `searchType` returns one **mixed** list of teachers + coachings + webinars, each item tagged with a `type` discriminator. Accepts `q` + `page`/`limit` only (`combinedSearchQuerySchema`, `.strict()` — any type-specific filter like `city` → `400`). App-level merge: each type fetched (capped at `COMBINED_FETCH_CAP=200`) with the **same projections** as single-type search (so the no-leak guarantee stays in one place — centers still expose contact info by design, teachers/webinars don't), then the pool is **stable-shuffled** by an FNV-1a hash of each `_id` so the order is random-looking but identical across pages (no dupes/skips). `total` = pool size. `runCombinedSearch` in `src/controllers/search.controller.ts`.
- **Verified (combined feed, live stack)**: feed returns all 51 mixed items (25 teacher / 25 webinar / 1 coaching) interleaved (not grouped); page 1 vs page 2 share no `_id`; identical order across repeated calls (stable shuffle); `q=physics` → 3 cross-type matches; `?city=…` (type-specific filter) → `400`; no `email`/`phone` on teacher/webinar items. `tsc --noEmit` clean.
- **Filters** (shared, validated by Zod `.strict()` in `src/schemas/search.schemas.ts`): `q` (keyword), `subject` (id **or** name/slug), `city`, `board` (enum), `minRating`, `minFees`/`maxFees`, geo (`lat`+`lng`+`distanceKm`, default 10km), `page`/`limit`. Sort: `averageRating desc → totalReviews desc`. Always `isActive:true`.
- **Keyword search uses regex `$or`** (teacher: `name`/`bio`/`description`; center: `name`/`description`/`area`), **not `$text`** — because Mongo can't combine `$text` with geo, and regex composes with every other filter.
- **Geo uses `$geoWithin: { $centerSphere: [[lng,lat], km/6378.1] }`**, **not `$near`** — `$near` is disallowed in `countDocuments` and forces a distance sort; `$geoWithin` works with pagination + count and leaves the rating sort intact. Both models already carry a `2dsphere` index on `location`. `lat`/`lng` must be supplied together (Zod refine → 400 otherwise).
- **Subject by name** — `resolveSubjectIds(subject)` (`src/lib/crud/resolveSubjectIds.ts`) accepts an ObjectId (used directly) or human text (resolved via `Subject` name/slug regex → ids); matches `Teacher.subjects` / `CoachingCenter.subjectsOffered` via `$in`. Unknown subject → empty result set (not an error).
- **Fees overlap** — `maxFees` → `feesRange.min/fees.min ≤ maxFees`; `minFees` → `feesRange.max/fees.max ≥ minFees`.
- **Public-safe output** — teachers via existing `projectTeacherPublic` (no email/phone); centers via new `projectCenterPublic` (allow-list; contact info **is** public since centers are business listings, but `owner`/`isActive`/`__v` are hidden). Both populate subjects (`name`,`slug`) for display.
- **Files**: `src/schemas/search.schemas.ts` (+`searchType` literals, `webinarSearchQuerySchema`, `SEARCH_TYPES`), `src/controllers/search.controller.ts` (run-teacher/center/webinar helpers + `search` dispatcher), `src/routes/search.routes.ts` (single `GET /`), `src/lib/crud/resolveSubjectIds.ts`, `src/lib/crud/projectCenterPublic.ts`, new `src/lib/crud/projectWebinarPublic.ts`, `src/middleware/validate.ts` (+exported `parseOrThrow`); mounted `/api/search` in `src/app.ts`. No model changes.
- **Verified end-to-end** (live Docker stack): missing/invalid `searchType` → `400` (generic "one of" message); `searchType=teacher` keyword search returns `{success,data,pagination}` with **no email/phone leak**, `lat` without `lng` → `400` (refine intact); `searchType=coaching` → `200`; `searchType=webinar&q=physics&status=scheduled&upcoming=true` returns the webinar with teacher populated `{name,profileImage}`; `searchType=webinar&subject=...` → `400` (`.strict()` rejects cross-type filter); no-token → `401`, teacher token → `403`; retired `/api/search/teachers` → `404`. `tsc --noEmit` clean.

### Phase 2.1.1 — Generic email-conflict response (shipped)
- **Why**: the previous `"Email already registered as <role>"` message was a textbook account-enumeration oracle — an attacker could probe an email and learn which role owns it. Requirement: every role collection (Owner / Teacher / Student / Admin) must still be checked, but the public response must be byte-identical no matter which role matches.
- **Public response (fixed contract, 409)** — for both `POST /api/auth/register` and `POST /api/admin/admins`, and for race-window duplicates that slip past the pre-check:
  ```json
  {
    "success": false,
    "error": {
      "code": "EMAIL_ALREADY_EXISTS",
      "message": "An account with this email already exists."
    }
  }
  ```
  No `userType`, no `id`, no role hint anywhere. Identical bytes for every role. `code` is machine-parseable so clients can branch without scraping the human message.
- **`src/lib/auth/emailUniqueness.ts`** rewritten:
  - Old role-leaking `findEmailOwner(email) → {userType, id} | null` **removed**.
  - New `isEmailTaken(email): Promise<boolean>` — boolean only, by construction unable to leak which role matched.
  - New `assertEmailAvailable(email)` — throws `EmailConflictError` on collision; controllers just `await` it.
  - New `EmailConflictError extends ApiError` — carries the frozen `EMAIL_CONFLICT_BODY` so the response envelope lives in one place and can't drift.
  - Exported `EMAIL_CONFLICT_CODE = 'EMAIL_ALREADY_EXISTS'` for parity with client-side branching.
  - All four role models live in a single `ROLE_MODELS` array — adding a fifth role is a one-line change. Queries fan out via `Promise.all(Model.exists(...))` (cheaper than `findOne().select().lean()` — Mongo returns at most `{_id}`).
- **`src/utils/ApiError.ts`** extended with an optional, read-only `body` field. When present, the error handler emits it verbatim and skips the default `{status, message}` envelope. Lets a single error pin its own public shape without leaking implementation details through the global handler.
- **`src/middleware/errorHandler.ts`** now:
  - emits `err.body` verbatim when an `ApiError` carries one;
  - detects Mongo `E11000` duplicate-key errors on the `email` index (`err.code === 11000 && err.keyPattern.email === 1`) and reshapes them to the same `EMAIL_CONFLICT_BODY` at 409 — closes the race-window leak where the raw Mongo message names the collection (i.e. the role).
  - Non-`ApiError` and bodyless `ApiError`s keep the legacy `{status: 'error', message}` shape — non-breaking.
- **Controllers** (`auth.controller.ts` register, `admin/admins.admin.controller.ts` create): the role-mention `throw new ApiError(409, 'Email already registered as <role>')` paths are gone; both now just `await assertEmailAvailable(email)`. Net effect is fewer lines and no path that knows which role owns the email.
- **Audit of full auth surface** confirms the generic envelope applies in every email-touching path:
  | Surface | How it's covered |
  |---|---|
  | `POST /api/auth/register` | `assertEmailAvailable` (pre-check) + E11000 reshape (race) |
  | `POST /api/admin/admins` | `assertEmailAvailable` (pre-check) + E11000 reshape (race) |
  | `PATCH /api/{role}/me`, `PATCH /api/admin/{role}/:id` | Zod `.strict()` rejects `email` field — email cannot be changed, so no conflict path exists |
  | `POST /api/auth/login` | "Invalid credentials" for both no-user and wrong-password — no email-existence enumeration |
  | `seedAdmin.ts` | CLI, not user-facing |
- **Race window** — the pre-check is not race-safe (no Mongo transactions in Phase 2; see ADR-0005, pending write). The E11000 reshape is the secondary defense: the race-loser sees the identical generic response, so the enumeration oracle stays closed even when the race fires.
- **Verified**: `tsc --noEmit` clean. `grep -rn 'findEmailOwner\|already registered as' src/` returns no matches.
- **Out of scope but noted**: `login` returns `"Account is deactivated"` when the email exists but `isActive=false`. Separate account-enumeration channel (tells an attacker the email exists, but not the role). Not folded into `"Invalid credentials"` yet — left for a follow-up decision.

### Owner-dashboard write APIs — every metric now driven by real activity (shipped)
The owner dashboard (`GET /api/owners/dashboard`) was read-only over four collections that had **no write API** (only the seeder wrote them), so its numbers never moved in production. Four endpoints close that gap. Each was built by mirroring an existing pattern in the repo; **no new architecture** (flat route → controller → Mongoose).

- **Profile-view recording** — `POST /api/centers/:id/views` feeds `weeklyProfileViews` + `profileViewStats`.
  - **Auth-restricted**: authenticated **students & teachers only** (`protect` + `requireRole('teacher','student')`). Anonymous → 401, owner/admin → 403.
  - **Polymorphic viewer**: `ProfileView.viewer` switched from `ref:'Student'` to `refPath:'viewerType'` with a required `viewerType` enum (`Student`|`Teacher`) — mirrors the `StudentBookmark` polymorphic pattern, so a teacher id isn't stored in a Student-typed ref. `seedDemo` now stamps `viewerType:'Student'` on seeded views.
  - Verifies the center exists & `isActive` (404). Raw event, no dedupe — the dashboard groups by day. `201 { success:true }`.
  - **Files**: edited `src/models/ProfileView.ts`, `src/controllers/centers.controller.ts` (+`recordView`), `src/routes/centers.routes.ts`, `src/scripts/seedDemo.ts`. (A short-lived `optionalProtect` middleware from the first iteration was removed once the rule changed to auth-required.)
  - **Verified**: anonymous 401, owner/admin 403, student/teacher 201, bad id 400, missing center 404; newest views carry the correct `viewerType`; dashboard weekly total + today's bucket climb live.

- **CoachingCenter reviews** — feeds `averageRating` + `totalReviews`. The model (`CoachingCenterReview`) and its `recalcStats` denormalisation hooks already existed; this exposes them over HTTP. **1:1 mirror of the teacher-reviews feature.**
  - Public `GET /api/centers/:id/reviews` (paginated, `student` populated); student-authored `POST /api/centers/:id/reviews` (404 if center missing/inactive, **409** duplicate via unique `(coachingCenter, student)`); author-only `PATCH`/`DELETE /api/center-reviews/:id` (sets `isEdited`, recalcs on every write).
  - **Files**: new `src/schemas/centerReviews.schemas.ts`, `src/controllers/centerReviews.controller.ts`, `src/routes/centerReviews.routes.ts`; edited `src/routes/centers.routes.ts` (nested GET/POST), `src/app.ts` (mounted `/api/center-reviews`).
  - **Verified**: list 200; create 201; duplicate 409; `.strict()`/range 400; no-auth 401; author edit 200 (`isEdited:true`); other-student edit 403; delete 204; center + dashboard `averageRating`/`totalReviews` rise on create (4→4.3, 3→4) and fall back on delete.

- **Student enquiry creation** — `POST /api/centers/:id/enquiries` feeds `weeklyEnquiries` + `recentEnquiries`. Student-only, body `{ message, subject? }`. Verifies center (404) and subject if given (404). No unique constraint → a student may send multiple enquiries (no 409). Response is an allow-list projection that **omits `ownerNotes`** (owner-private).
  - **Files**: new `src/schemas/enquiries.schemas.ts`, `src/controllers/enquiries.controller.ts`; edited `src/routes/centers.routes.ts` (nested POST).
  - **Verified**: create 201 (`status:'new'`, no `ownerNotes` leak); second enquiry 201; missing-message/unknown-key/bad-subject 400; nonexistent subject 404; no-auth 401; owner 403; bad/missing center 400/404; dashboard `weeklyEnquiries` +2 and newest enquiry surfaces in `recentEnquiries` with student contact.
  - **Out of scope** (chosen): owner list/manage enquiries (status + `ownerNotes`), student "my enquiries".

- **Owner-managed enrollments** — `activeStudents` (distinct students with an `active` enrollment). Owner-managed full roster: create + list + status-update, all owner-only and scoped to the caller's auto-resolved center (`CoachingCenter.findOne({ owner })`, same as the dashboard).
  - `POST /api/owners/enrollments` (`{ studentId, subject?, status? }`) — verifies student/subject (404); **soft 409 guard** against a second concurrent `active` row for the same student (the model index is intentionally non-unique to keep history). `GET /api/owners/enrollments` (filter `status`, paginate, student+subject populated). `PATCH /api/owners/enrollments/:id` — ownership-checked (403); sets `endedAt` on terminal status, clears it (re-checking the 409) on return to `active`.
  - **Files**: new `src/schemas/enrollments.schemas.ts`, `src/controllers/enrollments.controller.ts`; edited `src/routes/owners.routes.ts` (3 routes). Reuses `ENROLLMENT_STATUSES` from the model via `z.enum(...)`.
  - **Verified**: no-auth 401; student 403; bad id/`.strict()` 400; nonexistent student 404; create 201; duplicate-active 409; list 200 with contact + status filter; PATCH→completed 200 (`endedAt` set); other-owner PATCH 403; bad/missing enrollment id 400/404; dashboard `activeStudents` 3→4 on create, 4→3 on completion.

- **Cross-cutting**: all four were verified live in the Docker stack and `tsc --noEmit` is clean.

---

## 6. Docker setup

### `Dockerfile` (multi-stage)
- **Builder stage** (`node:22-alpine`) — installs all deps, runs `tsc`, produces `dist/`
- **Runtime stage** (`node:22-alpine`) — `NODE_ENV=production`, prod deps only, `USER node`, runs `node dist/server.js`
- Dev container targets the **builder** stage (has `tsx` + sources)
- Production image is lean — `tsx` and `typescript` are excluded

### `docker-compose.yml`
- `app` service — built from `./` with `target: builder` for dev; binds `./` into `/app`; anonymous volume preserves `node_modules`; runs `npm run dev`; depends on `mongo` + `redis` healthchecks
- `mongo` service — `mongo:7`, external volume `tuition-mongo-data`, healthcheck via `mongosh ping`
- `redis` service — `redis:7-alpine`, named volume `tuition-redis-data`, `--appendonly yes` for AOF persistence, healthcheck via `redis-cli ping`
- Ports: app on `127.0.0.1:5000`, mongo on `127.0.0.1:27017`, redis on `127.0.0.1:6379`
- App `MONGO_URI` overridden inside compose to `mongodb://mongo:27017/tuition_finder`; `REDIS_URL` overridden to `redis://redis:6379`

### `.dockerignore`
Excludes `node_modules`, `.git`, `.env`, `dist`, `coverage`, IDE folders.

---

## 7. Database setup

### MongoDB (primary store)
- **Engine**: MongoDB 7 via the compose `mongo` service.
- **Database**: `tuition_finder`.
- **Connection**: `src/config/db.ts` (`mongoose.connect`, logs `[mongo] connected to tuition_finder`).
- **Volume**: external named volume `tuition-mongo-data` (host-managed; survives container removals).

### Redis (refresh-token whitelist + family-tracking)
- **Engine**: Redis 7 (alpine) via the compose `redis` service. AOF persistence enabled.
- **Client**: `ioredis` singleton at `src/lib/redis.ts`; lazy connect at boot, graceful `quit()` on shutdown.
- **Used by**: refresh-token rotation only. Not used for caching, sessions, or pub/sub today.
- **Volume**: named volume `tuition-redis-data`.

### Collections currently present
| Collection | Purpose |
|---|---|
| `owners` | Owner auth + profile (new) |
| `teachers` | Teacher auth + profile (new) |
| `students` | Student auth + profile (new) |
| `admins` | Admin auth + permissions list (new) |
| `coachingcenters` | Centers owned by an Owner (Phase 1, ref flipped to Owner) |
| `subjects` | Subjects catalogue (Phase 1) |
| `reviews` | Center reviews by students (model renamed `Review`→`CoachingCenterReview`; collection name pinned) |
| `teacherreviews` | Teacher reviews by students (new; denormalises rating onto Teacher) |
| `webinars` | Teacher-hosted webinars (new; powers dashboard "upcoming webinars") |
| `studentbookmarks` | Student-saved Teacher/Webinar/CoachingCenter (new; polymorphic `refPath`) |
| `profileviews` | Per-view events on a CoachingCenter (new; powers owner-dashboard weekly/daily graph) |
| `enrollments` | Student↔center links with lifecycle status (new; powers owner-dashboard active-student count) |
| `enquiries` | Student enquiries to centers (Phase 1, ref flipped to Student) |

### Key indexes
- `coachingcenters`: `2dsphere` on `location`; text on `name/description/area`; compound on `(city, isActive, isVerified)`; descending on `averageRating`; unique `slug`.
- `subjects`: unique `name`, unique `slug`.
- `reviews`: compound unique `(coachingCenter, student)`.
- `teachers`: text on `name/bio/description`; `subjects`; `(feesRange.min, feesRange.max)`; descending `averageRating`; sparse `2dsphere` on `location`; compound on `(city, isActive, isVerified)`.
- `students`: sparse `2dsphere` on `location`; `city`.
- `profileviews`: compound `(coachingCenter, viewedAt desc)` for the 7-day window scan.
- `enrollments`: compound `(coachingCenter, status, student)` (non-unique; history kept, active students de-duped via `$addToSet`).
- All four role collections: `email` unique-per-collection.

### Demo data (`npm run seed:demo`)
- **`src/scripts/seedDemo.ts`** — one command that **wipes** all 13 collections and inserts a fresh, fully-linked demo dataset so **every API returns real data**: 12 subjects, 1 admin, **5 owners** (1:1 with centers so each owner dashboard resolves a center), 8 teachers, 10 students, 5 centers, 10 webinars, 24 teacher reviews, 15 center reviews, 15 bookmarks, 8 enquiries, **350 profile views** (spread across the last 7 days; day 2 left at 0 to prove zero-fill), **30 enrollments** (3 active + completed/cancelled/expired per center).
- Built via `new Model({...}).save()` (fires bcrypt + slug + rating-recalc hooks; sidesteps Mongoose v9's array-`create` typing). Subjects/centers omit `slug` (auto). Reviews created after teachers/centers so denormalised `averageRating`/`totalReviews` populate. Geo uses `[lng,lat]` across Kolkata/Mumbai/Delhi/Bangalore.
- **All demo accounts share password `Password123`**: `admin@demo.com`, `owner1..4@demo.com`, `teacher1..8@demo.com`, `student1..10@demo.com`.
- Run inside the Docker app container (so it uses the compose Mongo URI): `docker compose exec app npm run seed:demo`.
- **Verified**: student dashboard 5/3/2 sections; search totals teacher 8 / coaching 5 / webinar 10 / combined 23; teacher ratings denormalised to 2.0–4.0; public subjects 12 / webinars 10; admin teacher list 8; reviews/bookmarks populated; **owner dashboard** (`owner1@demo.com`) returns weeklyProfileViews 58 / 7-day stats with zero-filled day / activeStudents 3 / recent enquiries with contact, and isolates per owner (owner2 = 64). `tsc --noEmit` clean.

---

## 8. Authentication work

### Architecture (locked)
- **Four separate auth collections** — no shared User table, no discriminators.
- One register endpoint + one login endpoint; `userType` is part of the request body.
- **Two-token model**:
  - **Access JWT** (`15m`, payload `{sub, userType, tokenType:'access'}`) — `Authorization: Bearer …` header. Signed with `JWT_SECRET`.
  - **Refresh JWT** (`7d`, payload `{sub, userType, jti, family, tokenType:'refresh'}`) — returned **both** in the JSON response body (`refreshToken`) and as an HTTP-only secure cookie scoped to `/api/auth`. Signed with separate `JWT_REFRESH_SECRET`. The cookie remains the recommended transport for browsers; the body value is convenience for mobile/CLI clients (and a known XSS-exposure trade-off documented in API docs).
- **Refresh state lives in Redis** (`rt:jti:<jti>` → `<familyId>`, `rt:family:<familyId>` → Set of JTIs). Atomic single-use rotation via `DEL`-check; reuse triggers full family revocation.
- bcrypt (12 rounds) via `bcryptjs` (pure-JS, no native build in Alpine).
- Cross-collection email uniqueness enforced via `assertEmailAvailable(email)` helper (see Phase 2.1.1). On collision the API always returns the generic `{success:false, error:{code:"EMAIL_ALREADY_EXISTS", message:"An account with this email already exists."}}` at 409 — role is never disclosed. Race-window E11000s are reshaped to the same body by the error handler. **Known race window for the underlying insert** — accepted for Phase 2; documented as ADR-0005 (pending write).

### Files
- `src/lib/auth/passwordHook.ts`
- `src/lib/auth/jwt.ts` *(issueAccess / issueRefresh / verifyAccess / verifyRefresh)*
- `src/lib/auth/refreshTokens.ts` *(Redis whitelist, rotation, reuse detection, family revoke)*
- `src/lib/auth/emailUniqueness.ts`
- `src/lib/redis.ts` *(ioredis singleton + lifecycle)*
- `src/middleware/protect.ts`
- `src/middleware/requireRole.ts`
- `src/middleware/asyncHandler.ts`
- `src/controllers/auth.controller.ts`
- `src/routes/auth.routes.ts`
- `src/types/express.d.ts`
- `src/scripts/seedAdmin.ts`

### Behaviour verified
- Register owner / teacher / student → 201 with `{success, accessToken, refreshToken, user}` + refresh cookie
- Login all four roles → 200 with `{success, accessToken, refreshToken, user}` + refresh cookie
- `GET /api/auth/me` with Bearer → 200 with `{success, userType, user}`
- `POST /api/auth/refresh` with valid cookie → 200 with `{success, accessToken, refreshToken}` + **rotated** refresh cookie (new JTI)
- Replay of an already-rotated refresh token → **401** + entire family revoked (logged at WARN with `{jti, family, sub}`)
- After reuse-revocation, the most recent legit refresh also stops working — user must re-login
- `POST /api/auth/logout` with valid cookie → **204**, cookie cleared, JTI removed from Redis
- Logout is idempotent — calling with no/invalid cookie still 204s and clears
- Password change (via `POST /api/{role}/me/password`) **revokes all sessions** for that user (Redis `rt:user:<sub>:families` set is drained), then re-issues access + refresh for the calling device only
- Cross-collection email collision → **409** `{success:false, error:{code:"EMAIL_ALREADY_EXISTS", message:"An account with this email already exists."}}` — identical bytes for all four roles, no enumeration oracle (see Phase 2.1.1)
- Wrong password → **401** "Invalid credentials"
- `npm run seed:admin` creates the root admin idempotently
- Admin login bumps `lastLoginAt`
- Cookie attributes verified: `HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=604800; Secure` (Secure only in prod)

### Out of scope for now (deferred to Phase 3+)
- Email verification, password reset, 2FA
- Granular admin permission enforcement (the `permissions[]` field is stored but not yet checked)
- `POST /api/auth/logout-all` (revoke all sessions for a user across devices)
- Refresh-token cross-instance correlation IDs (current numeric `req.id` is per-process)

---

## 9. APIs created

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | public | Hello banner |
| GET | `/api/health` | public | uptime + env + timestamp |
| POST | `/api/auth/register` | public | body `{userType, name, email, password, phone?}`; userType ∈ `owner\|teacher\|student`. Returns `{success, accessToken, refreshToken, user}`. Also sets `refreshToken` HTTP-only cookie. |
| POST | `/api/auth/login` | public | body `{userType, email, password}`; userType ∈ all four. Returns `{success, accessToken, refreshToken, user}`. Also sets `refreshToken` HTTP-only cookie. |
| POST | `/api/auth/refresh` | refresh cookie | Rotates the refresh token; returns `{success, accessToken, refreshToken}` (new access + new refresh). Old JTI is single-use — replay → 401 + family revoked. |
| POST | `/api/auth/logout` | refresh cookie | Revokes the current JTI in Redis, clears cookie. 204. Idempotent. |
| GET | `/api/auth/me` | Bearer | returns `{success, userType, user}` |
| PATCH | `/api/owners/me` | Bearer (owner) | Whitelisted self-update (name, phone, profileImage). `.strict()` blocks privilege escalation. |
| DELETE | `/api/owners/me` | Bearer (owner) | Soft-deactivate + `revokeAllForUser`. 204. |
| POST | `/api/owners/me/password` | Bearer (owner) | `{currentPassword, newPassword}` → 200 `{success, accessToken, refreshToken}` + new refresh cookie. Sibling sessions revoked. |
| GET | `/api/centers` | **public** | List active centers + pagination + filters (`q`, `city`, `board`, `isVerified`). Public projection (no `owner`/`isActive`), `subjectsOffered` populated, sorted by rating. |
| GET | `/api/centers/me` | Bearer (owner) | Owner's own center, any state. 404 if none. |
| GET | `/api/centers/:id` | **public** | Single active center. 404 if missing or `!isActive`. 400 on bad ObjectId. |
| POST | `/api/centers` | Bearer (owner) | Create center (`owner` from token, `slug` auto). 409 if owner already has one. `.strict()`. |
| PATCH | `/api/centers/:id` | Bearer (owner) | Owner-only edit. 403 on others'. 409 on slug clash. |
| DELETE | `/api/centers/:id` | Bearer (owner) | Owner-only soft-delete (`isActive=false`). 204. |
| GET | `/api/owners/dashboard` | Bearer (owner) | Owner's coaching-center dashboard. Returns `{success, data:{weeklyProfileViews, weeklyEnquiries, averageRating, totalReviews, activeStudents, profileViewStats[7], recentEnquiries[≤5]}}`. Auto-resolves the owner's single center (404 if none). 7-day window = today + prev 6 days; daily stats always 7 entries ascending, zero-filled. |
| PATCH | `/api/teachers/me` | Bearer (teacher) | Rich self-PATCH (bio, education, batches, fees, boards, location, etc. — 17 fields). |
| DELETE | `/api/teachers/me` | Bearer (teacher) | Same as owner. |
| POST | `/api/teachers/me/password` | Bearer (teacher) | Same as owner. |
| GET | `/api/teachers/:id` | **public** | Public-safe projection — no email/phone. 404 if `!isActive`. 400 on bad ObjectId. |
| PATCH | `/api/students/me` | Bearer (student) | DOB / gender / currentClass / board / city / location. |
| DELETE | `/api/students/me` | Bearer (student) | Same. |
| POST | `/api/students/me/password` | Bearer (student) | Same. |
| PATCH | `/api/admins/me` | Bearer (admin) | Basic fields only (name, phone, profileImage). Permissions are admin-on-admin. |
| DELETE | `/api/admins/me` | Bearer (admin) | Same. |
| POST | `/api/admins/me/password` | Bearer (admin) | Same. |
| GET | `/api/admin/{owners\|teachers\|students\|admins}` | Bearer (admin) | List + pagination + filters (`q,city,isActive,isEmailVerified` + `isVerified` on teachers). |
| GET | `/api/admin/{role}/:id` | Bearer (admin) | |
| PATCH | `/api/admin/{role}/:id` | Bearer (admin) | Admin-wider field set (incl. `isActive`, `isEmailVerified`, `isVerified` on teachers, `permissions[]` on admins). |
| PATCH | `/api/admin/{role}/:id/deactivate` | Bearer (admin) | Sets `isActive=false` + revokes all sessions. 204. |
| PATCH | `/api/admin/{role}/:id/activate` | Bearer (admin) | Sets `isActive=true`. |
| POST | `/api/admin/admins` | Bearer (admin) | Bootstrap successor admin (`createdBy` set, no auto-login). |
| GET | `/api/students/dashboard` | Bearer (student) | Aggregated `{topTeachers(5), topCenters(3), upcomingWebinars(3)}`. Webinars ranked by host teacher's `totalReviews`, within next 2 days. |
| GET | `/api/webinars` | public | List + pagination + filters (`teacher`, `status`, `upcoming`); teacher populated. |
| GET | `/api/webinars/:id` | public | Single webinar (teacher populated). 404 if `!isActive`. |
| POST | `/api/webinars` | Bearer (teacher) | Create webinar (teacher from token, not body). `.strict()`. |
| PATCH | `/api/webinars/:id` | Bearer (teacher) | Owner-only edit. 403 on others'. |
| DELETE | `/api/webinars/:id` | Bearer (teacher) | Owner-only soft-delete (`isActive=false`). 204. |
| GET | `/api/teachers/:id/reviews` | public | Paginated teacher reviews (`student` populated). |
| POST | `/api/teachers/:id/reviews` | Bearer (student) | Review a teacher. 404 if teacher missing/inactive, 409 on duplicate. Recalcs Teacher rating. |
| PATCH | `/api/teacher-reviews/:id` | Bearer (student) | Author-only edit (sets `isEdited`, recalcs rating). |
| DELETE | `/api/teacher-reviews/:id` | Bearer (student) | Author-only delete (recalcs rating). 204. |
| GET | `/api/subjects` | **public** | List **active** subjects + pagination + filters (`q`, `category`). |
| GET | `/api/subjects/:id` | **public** | Single active subject. 404 if missing or `!isActive`. 400 on bad ObjectId. |
| GET | `/api/admin/subjects` | Bearer (admin) | List **all** subjects (incl. inactive) + filters (`q`, `category`, `isActive`). |
| GET | `/api/admin/subjects/:id` | Bearer (admin) | Single subject, any state. |
| POST | `/api/admin/subjects` | Bearer (admin) | Create. `slug` auto-derived; `.strict()`. 409 on duplicate name. |
| PATCH | `/api/admin/subjects/:id` | Bearer (admin) | Update `name`/`category`/`description`/`isActive`. 409 on duplicate name. (No DELETE — hide via `isActive`.) |
| GET | `/api/search` | Bearer (student) | **Unified search.** `searchType` ∈ `teacher\|coaching\|webinar` dispatches to one entity; **omitted/empty → combined mixed feed** of all three (see below). Invalid value → 400. `teacher`/`coaching` filters: `q`, `subject` (id or name), `city`, `board`, `minRating`, `minFees`/`maxFees`, geo (`lat`+`lng`+`distanceKm`), pagination — public-safe projection, sorted by rating. `webinar` filters: `q` (title/description), `status`, `upcoming`, `teacher` (id), pagination — sorted soonest-first, teacher populated. Combined mode accepts `q` + pagination only; each item tagged `type`; stable-shuffled by `_id` (consistent across pages). Wrong filter for the type → 400 (`.strict()`). |
| POST | `/api/students/bookmarks` | Bearer (student) | Save a Teacher/Webinar/CoachingCenter. Body `{targetType, targetId}`. 404 missing/inactive, 409 duplicate. Returns the enriched item (full student + projected target). |
| GET | `/api/students/bookmarks` | Bearer (student) | List caller's bookmarks (newest-first, `?targetType=` filter). Each item embeds the full caller `student` (own profile, no password) + fully-projected `target` (per-type public-safe, no PII leak). |
| DELETE | `/api/students/bookmarks/:id` | Bearer (student) | Delete own bookmark by id. 403 on others', 404 if missing. 204. |
| POST | `/api/centers/:id/views` | Bearer (student\|teacher) | Record a profile view (feeds dashboard `weeklyProfileViews`/`profileViewStats`). Anonymous → 401, owner/admin → 403. Polymorphic `viewer` (`viewerType` Student\|Teacher). 404 if center missing/inactive. 201. |
| GET | `/api/centers/:id/reviews` | public | Paginated center reviews (`student` populated). |
| POST | `/api/centers/:id/reviews` | Bearer (student) | Review a center. 404 if missing/inactive, 409 duplicate. Recalcs center `averageRating`/`totalReviews`. |
| PATCH | `/api/center-reviews/:id` | Bearer (student) | Author-only edit (sets `isEdited`, recalcs). |
| DELETE | `/api/center-reviews/:id` | Bearer (student) | Author-only delete (recalcs). 204. |
| POST | `/api/centers/:id/enquiries` | Bearer (student) | Send an enquiry to a center (`{message, subject?}`). Feeds dashboard `weeklyEnquiries`/`recentEnquiries`. 404 center/subject; response omits `ownerNotes`. 201. |
| GET | `/api/owners/enquiries` | Bearer (owner) | List enquiries for the owner's center (`?status=&page=&limit=`, student+subject populated). Returns full docs incl. `ownerNotes`. |
| GET | `/api/owners/enquiries/search` | Bearer (owner) | Search the owner's center enquiries by `q` (message+ownerNotes), `status`, `subject` (id/name), `student` (id/name/email), `dateFrom`/`dateTo` (createdAt), pagination. Always scoped to the owner's center. `dateFrom>dateTo`→400. Registered before `/:id`. |
| GET | `/api/owners/enquiries/:id` | Bearer (owner) | Read one enquiry in full. 403 on others', 404 if missing, 400 bad id. |
| PATCH | `/api/owners/enquiries/:id` | Bearer (owner) | Update `status` (`new`→`contacted`/`closed`) and/or `ownerNotes`. 403 on others'; empty/unknown-key/bad-status body → 400. |
| GET | `/api/students/enquiries` | Bearer (student) | Caller's sent enquiries (`?status=&page=&limit=`, center+subject populated). `ownerNotes` hidden. |
| GET | `/api/students/enquiries/search` | Bearer (student) | Search caller's own enquiries by `q` (message only), `status`, `subject` (id/name), `dateFrom`/`dateTo`, pagination. `ownerNotes` never exposed. |
| POST | `/api/owners/enrollments` | Bearer (owner) | Enroll a student at the owner's center (`{studentId, subject?, status?}`). 404 student/subject; **409** if already actively enrolled. Feeds dashboard `activeStudents`. 201. |
| GET | `/api/owners/enrollments` | Bearer (owner) | List the owner's center enrollments (`?status=&page=&limit=`, student+subject populated). |
| PATCH | `/api/owners/enrollments/:id` | Bearer (owner) | Update status (`active`→`completed`/`cancelled`/`expired`); sets/clears `endedAt`. 403 on others'. |

Endpoints still pending from Phase 2 (courses, admin center moderation) — see section 11.

---

## 10. UI / components completed

**None.** This is a backend-only project. No frontend / admin UI is in scope; the admin panel will be REST endpoints only.

---

## 11. Pending tasks

### Phase 2.2 — CoachingCenter CRUD + Subjects (mostly shipped)
- ✅ Controllers + routes for centers (`POST/GET/PATCH/DELETE /api/centers` + `GET /api/centers/me`, public reads, owner writes, soft delete) — see section 5 "CoachingCenter CRUD".
- ✅ Public subject list/get + admin subject create/update (`/api/subjects` + `/api/admin/subjects`) — see section 5 "Subject CRUD". No delete (hide via `isActive`).
- `seedSubjects.ts` for canonical subject fixture — **pending** (covered in practice by `seed:demo`)
- Still pending: **admin** center moderation (list/verify/activate — Phase 2.6); wire subjects into teacher/center references on search beyond current support

### Phase 2.3 — Course + TeacherCenterAssignment
- New models: `Course`, `TeacherCenterAssignment`
- `Course` nested under `CoachingCenter` (Owner → Center → Course → Teachers)
- Owner invites teacher by email (auto-resolves on teacher signup via post-save hook)
- Teacher accept/reject; reverse flow (teacher request join, owner approve)
- Add `courses` virtual to `CoachingCenter`

### Phase 2.4 — Reviews (teachers) *(mostly shipped)*
- ✅ New model: `TeacherReview` with denormalised rating hooks on `Teacher`
- ✅ Routes: `POST /api/teachers/:id/reviews`, edit/delete on `/api/teacher-reviews/:id`
- ✅ Student-authored **center** reviews shipped via `CoachingCenterReview` — `GET`/`POST /api/centers/:id/reviews` + edit/delete `/api/center-reviews/:id` (see section 5 "Owner-dashboard write APIs").
- ADR-0005 (cross-collection email race) + ADR-0006 (teacher rating denormalisation) — pending write

### Phase 2.5 — Search (in progress)
- ✅ Unified student search `GET /api/search?searchType=teacher|coaching|webinar` (student-only). See section 5 "Student search".
- ✅ Teacher search (`q`, `subject` id/name, `city`, `board`, `minRating`, `minFees/maxFees`, `lat/lng/distanceKm`).
- ✅ Center search (same filter set, against `subjectsOffered`/`fees.*`).
- ✅ Webinar search (`q`, `status`, `upcoming`, `teacher`).
- Still pending: `area` filter on center search; Course search (subject, center, fees) — needs Phase 2.3 Course model.
- Note: keyword search is regex-based (composes with geo); relevance scoring / `$text` ranking left for a follow-up if needed.

### Phase 2.6 — Admin panel
**User/role moderation shipped** (see section 8 "Full CRUD"). Still pending:
- Listings, activate/deactivate, verify-toggle for **centers** (Phase 2.2 dep)
- Subject CRUD + bulk seed endpoint
- Hard-delete on reviews/courses/subjects (currently soft-delete only on users)

### Phase 2.7 — Profile updates per role *(shipped)*
- ✅ `PATCH/DELETE /api/owners/me` + `POST /api/owners/me/password`
- ✅ `PATCH/DELETE /api/teachers/me` (17-field rich PATCH) + `POST /api/teachers/me/password`
- ✅ `PATCH/DELETE /api/students/me` + `POST /api/students/me/password`
- ✅ `PATCH/DELETE /api/admins/me` + `POST /api/admins/me/password`
- ✅ Public `GET /api/teachers/:id` (allow-list projection, no email/phone leak)
- Deferred: **email-change flow** (cross-collection re-uniqueness + re-verification), **admin-driven password reset** (token email), **hard delete** (would orphan CoachingCenter/Review/Enquiry refs)

### Owner-dashboard write APIs — follow-ups (core shipped; see section 5)
- ✅ Profile-view recording, center reviews, enquiry creation, owner-managed enrollments — every dashboard metric is now driven by real API activity.
- ✅ **Enquiry section completed** — owner-side management (`GET /api/owners/enquiries` list + `?status=`, `GET /api/owners/enquiries/:id` detail, `PATCH /api/owners/enquiries/:id` status + `ownerNotes`) and student "my enquiries" (`GET /api/students/enquiries`, `ownerNotes` hidden). Mirrors the enrollments owner-scoped pattern; `ENQUIRY_STATUSES` now exported from the model and shared with Zod. Verified live: owner list shows `ownerNotes`, foreign detail/patch → 403, bad/missing id → 400/404, empty/unknown-key/bad-status body → 400, student list leaks no `ownerNotes` + `?status=` filter, authz 401/403 on both roles; create + dashboard `recentEnquiries` regress clean. `tsc --noEmit` clean.
- ✅ **Enquiry search** — `GET /api/owners/enquiries/search` (always scoped to the owner's one center) and `GET /api/students/enquiries/search` (always scoped to the caller). Filters build one Mongo query incrementally (mirrors `search.controller.ts`): `q` keyword (owner: message+ownerNotes; student: message only), `status`, `subject` (id or name via `resolveSubjectIds`), `dateFrom`/`dateTo` on `createdAt` (refine `dateFrom≤dateTo`), pagination; owner-only `student` filter resolves an **id OR name/email** via new `src/lib/crud/resolveStudentIds.ts` (no `isActive` restriction, so historically-deactivated students are still findable). Owner search routes are registered **before** `/enquiries/:id` so `search` isn't parsed as an id. Verified live: every filter (incl. subject-by-name, student-by-name & by-email, ownerNotes keyword owner-only, date windows), `dateFrom>dateTo`/bad-status/unknown-key/non-date → 400, per-center scoping (owner1≠owner2), student search leaks no `ownerNotes` (ownerNotes-only word matches 0), authz 401/403, routing + `/:id` regression. `tsc --noEmit` clean.
- Still pending (deliberately out of scope): student self-enroll / student "my enrollments", enrollment hard-delete, auto-expiry job for `expired` enrollments.
- Frontend wiring (e.g. firing `POST /api/centers/:id/views` on the center profile page) — out of scope for this backend repo.

### Cross-cutting (deferred)
- File upload pipeline (multer + storage adapter) for profile/banner images
- Request validation (Zod or express-validator)
- helmet + rate limiting *(HTTP request logging now covered by pino-http — morgan no longer needed)*
- Tests — schema validation, JWT round-trip, `recalcStats` correctness, owner-of-center guard, assignment state machine
- ESLint + Prettier
- CI / GitHub Actions
- Email verification / password reset / 2FA *(refresh tokens shipped — see section 8)*
- Mongo replica set + transactional registration (closes the cross-collection email race)
- Frontend / admin UI (out of scope for this backend repo)

### Known issues / risks
- **Cross-collection email race** — two concurrent registrations of the same email into different collections can both succeed. Tolerable for Phase 2; will need transactions in Phase 3.
- **Orphaned invites** — if an owner invites a teacher by email and that email later registers as Student/Owner/Admin, the invite never auto-resolves (only Teacher signup triggers the hook).
- **`Admin.permissions` not enforced** — stored but every admin currently has full access.
- **Dangling `StudentBookmark`s** — bookmarks aren't cascade-cleaned when their target (Teacher/Webinar/CoachingCenter) is deleted; a stale bookmark populates `target: null` on list. Needs a cleanup hook or a null-target filter once hard-deletes land.
- **Git push to `main` blocked** — local commit `af7d7ae` exists, but the remote rejects pushes from `weloin-subhadip` (repo is owned by `weloin-soumyadip`). Either get added as collaborator or push from the owner's credentials.

---

## 12. Quick start (current state)

```bash
# Boot dev stack
docker compose up -d --build
docker compose logs -f app

# Verify
curl -s localhost:5000/api/health

# Register / login — capture refresh cookie into a jar
curl -s -c jar.txt -X POST localhost:5000/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"userType":"owner","name":"Alice","email":"alice@x.com","password":"secret123"}'

curl -s -c jar.txt -X POST localhost:5000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"userType":"owner","email":"alice@x.com","password":"secret123"}'

# Rotate access token using the refresh cookie
curl -s -b jar.txt -c jar.txt -X POST localhost:5000/api/auth/refresh

# Logout — revokes refresh JTI in Redis and clears cookie
curl -s -b jar.txt -c jar.txt -X POST localhost:5000/api/auth/logout

# Self-update profile (after login — uses Bearer + refresh cookie)
TOKEN=$(curl -s -X POST localhost:5000/api/auth/login -H 'content-type: application/json' \
  -d '{"userType":"owner","email":"alice@x.com","password":"secret123"}' | jq -r .token)
curl -s -X PATCH localhost:5000/api/owners/me \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"Alice (Updated)"}'

# Change password — revokes all sibling sessions
curl -s -b jar.txt -c jar.txt -X POST localhost:5000/api/owners/me/password \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"currentPassword":"secret123","newPassword":"newsecret9"}'

# Admin moderation (list + deactivate)
ADMIN_TOKEN=$(curl -s -X POST localhost:5000/api/auth/login -H 'content-type: application/json' \
  -d '{"userType":"admin","email":"root@x.com","password":"secret123"}' | jq -r .token)
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" 'localhost:5000/api/admin/teachers?city=Kolkata'

# Bootstrap admin (run once in dev)
SEED_ADMIN_EMAIL=root@x.com SEED_ADMIN_PASSWORD=secret123 npm run seed:admin
```
