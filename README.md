# Dr. Bharath's Acu Heal — Clinic Management System

Multi-branch clinic management for [Dr. Bharath's Acu Heal](https://acuheal.co.in/) (Anna Nagar,
Valasaravakkam and Alwarpet, Chennai), built around acupuncture workflows: multi-session treatment
packages with live session meters, bedside clinical notes, branch-prefixed patient IDs and invoices,
WhatsApp reminders, biometric attendance and day-to-day accounts.

The original sales proposal is preserved unchanged in [`proposal/`](proposal/) and still deploys on
its own.

---

## Contents

| Path | What it is |
|---|---|
| `apps/web` | Next.js 15 (App Router), React 19, Tailwind 4, PWA. The whole user interface. |
| `apps/api` | Express 5 + TypeScript + Mongoose 8. REST API under `/api/v1`. |
| `packages/types` | Shared enums, zod schemas and the **standardized form-field definitions**. |
| `packages/tsconfig` | Shared TypeScript presets. |
| `proposal/` | The original static quotation site (unchanged). |

### Standardized form fields

Every form in the app is generated from one descriptor list per entity in
`packages/types/src/fields/`. The same file drives the rendered form, the API's zod validation and
the seed data, so all three branches capture identical fields and a label change is a one-line edit.
`FormRenderer` (`apps/web/src/components/forms/FormRenderer.tsx`) turns any descriptor list into a
sectioned form.

Covered entities: patient intake, appointment, treatment package, session log, invoice, payment,
lead, follow-up, staff, salary payment, expense, vendor, purchase, media, branch and attendance.

---

## Run it locally in one command

No database to install — this boots an in-memory MongoDB and seeds a full demo clinic:

```bash
pnpm install && pnpm demo
```

Then in a second terminal:

```bash
pnpm --filter @acuheal/web dev
```

Open http://localhost:3000 and sign in:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@acuheal.local` | `Admin@12345` |
| Doctor | `priya@acuheal.local` | `Demo@12345` |
| Front-desk | `frontdesk1@acuheal.local` | `Demo@12345` |
| Accounts | `accounts@acuheal.local` | `Demo@12345` |

Demo data is ephemeral: it is rebuilt on every restart. Point `MONGODB_URI` at a real database for
anything you want to keep.

### Running against a real database

```bash
cp apps/api/.env.example apps/api/.env     # set MONGODB_URI and the JWT secrets
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @acuheal/api seed            # branches, admin, message templates
pnpm --filter @acuheal/api seed:demo       # the above plus demo patients and activity
pnpm dev
```

`pnpm build`, `pnpm typecheck` and `pnpm lint` run across the workspace.

---

## Modules

**Front desk** — patient register with live duplicate detection across all branches and one-tap
auto-fill; webcam photo capture; appointment day directory with a slot grid, reschedule history and
cancellation reasons.

**Clinical** — treatment packages with a session meter (`Session 5 / 12`), per-session clinical
notes capturing points used, technique, needle retention, pain before/after and adverse events; a
mobile-first doctor queue for bedside use; contraindication flags shown as a red banner on the
patient record and in the queue.

**Billing** — branch-and-financial-year invoice numbering (`ANR/INV/2026-27/0001`), itemised
invoices, partial payments against invoices or packages, and A4 plus 80mm thermal print layouts with
the clinic logo.

**Growth** — CRM pipeline (New → Follow-up → Attended → Converted → Lost) with source attribution
and conversion analytics; converting a lead pre-fills the registration form and links both records.
WhatsApp templates in English and Tamil with automatic session reminders and birthday wishes.

**Operations** — expenses, vendors and purchases, staff directory with salary structures and
payments, biometric attendance, media archive with a live storage meter, executive dashboard with
branch comparison, and an audit log of sensitive changes.

### Integrations

- **WhatsApp** — provider interface with a `console` driver (logs to the API and the in-app send
  log) and a Meta Cloud API driver. Switch with `WHATSAPP_PROVIDER`; no code change.
- **Biometric attendance** — device-agnostic. Push punches to
  `POST /api/v1/integrations/biometric/push` with an `x-api-key` header, or import the device's CSV
  export from the Attendance page. Staff are matched on their biometric user ID.
- **Media storage** — S3-compatible presigned uploads (Cloudflare R2) with a local-disk driver for
  development. Videos are capped at 15 MB, photos at 5 MB.

---

## Roles

| | Admin | Doctor | Front-desk | Accounts |
|---|---|---|---|---|
| Patients & appointments | ✅ | ✅ | ✅ | read |
| Clinical session notes | ✅ | ✅ | — | — |
| Billing & payments | ✅ | read | ✅ | ✅ |
| CRM | ✅ | read | ✅ | — |
| Accounts, vendors, salaries | ✅ | — | — | ✅ |
| Staff & branch admin | ✅ | — | — | read |
| Switch branches | ✅ | ✅ | locked | ✅ |

Permissions live in `packages/types/src/permissions.ts` and are enforced on every API route. Users
without `branches:all` are locked to their default branch server-side, so a forged `x-branch-id`
header cannot widen access.

---

## Demo deployment (free tiers)

| Piece | Host | Notes |
|---|---|---|
| Database | MongoDB Atlas M0 | 512 MB, free forever |
| API | Render free web service | Sleeps after 15 min idle; ~30–50 s cold start |
| Web | Vercel Hobby | Root directory `apps/web` |
| Media | Cloudflare R2 | 10 GB, no egress fees |
| Cron | cron-job.org | Keeps Render awake and fires the daily jobs |

1. **Atlas** — create an M0 cluster, add a database user, allow `0.0.0.0/0` under Network Access
   (Render's free tier has no static IP). Copy the connection string.
2. **R2** — create a bucket and an API token, and add a CORS rule allowing `PUT` from your Vercel
   origin.
3. **API** — in Render, New → Blueprint, pick this repo. [`render.yaml`](render.yaml) defines the
   service. Set `MONGODB_URI`, `CORS_ORIGIN` (your Vercel URL), `API_PUBLIC_URL` (the Render URL)
   and the four `R2_*` values in the dashboard. Secrets marked `generateValue` are created for you.
4. **Web** — import the repo in Vercel with root directory `apps/web`, and set
   `NEXT_PUBLIC_API_URL` to `https://<your-render-service>.onrender.com/api/v1`.
5. **Seed** — run `pnpm --filter @acuheal/api seed` locally with `MONGODB_URI` pointing at Atlas.
6. **Cron** — on cron-job.org, add a `GET` to `/api/v1/health` every 10 minutes, plus daily `POST`s
   to `/api/v1/jobs/reminders` and `/api/v1/jobs/birthdays` with the header
   `x-jobs-secret: <JOBS_SECRET>`.

If the Render cold start is a problem for a live demo, [Koyeb](https://koyeb.com)'s free nano
instance stays awake and runs the same [`apps/api/Dockerfile`](apps/api/Dockerfile) with no code
change.

Set `COOKIE_SECURE=true` in production: the refresh token is an httpOnly cookie and the web and API
live on different domains.

---

## Not included

The AI multilingual voice receptionist is a separate Phase 2 project. Also out of scope per the
proposal: pharmacy/dispensary inventory, IPD bed management, laboratory diagnostics, native App
Store builds, ERP connectors and the public marketing website.

---

Software by **BUILD FAST WEB** · +91 97895 02278 · proposal ref BFW-ACU-2026-01
