# APEXTrack setup

APEXTrack is a Next.js App Router dashboard for a flexible daily routine: fitness, DSA, side-hustle work, hybrid workdays, sleep tracking, and progress analytics.

## Requirements

- Node.js 18.17 or later
- A Supabase project

## Configure Supabase

1. In Supabase, enable **Authentication → Providers → Anonymous sign-ins** and **Email**. Email/password accounts let you sign in across devices; email confirmation can be configured under **Authentication → Email**. Guest sessions start anonymously, and **Save progress** upgrades the current guest account with an email/password so its existing logs remain attached.
2. Copy `.env.example` to `.env.local` and fill in the project URL and public anon key from **Project Settings → API**:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

   The anon key is intended for browser use. Never put a service-role key in a `NEXT_PUBLIC_` variable.
3. Apply the SQL migrations in timestamp order in the Supabase SQL Editor. For a new project, run [`supabase/migrations/20261022000000_initial_schema.sql`](./supabase/migrations/20261022000000_initial_schema.sql), then [`supabase/migrations/20261024000000_custom_routines_and_office_days.sql`](./supabase/migrations/20261024000000_custom_routines_and_office_days.sql). If the initial schema is already installed, run only the second migration:

   The migrations add per-user routine templates, office weekdays, a configurable sleep target, indexes and constraints, user-scoped RLS policies, and default routine templates for existing and new users. Existing daily tasks and workday records are retained as historical snapshots. Ensure the `public` schema is exposed through the project's API settings.

   If you manage schema changes with the Supabase CLI instead, use its migration workflow and make sure the migrations already applied manually in SQL Editor are recorded/baselined before pushing; do not blindly push the initial schema into a database where it has already been run.

## Run locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app creates an anonymous account on first use and starts each day with weighted task blocks. Use **Save progress** in the dashboard header to upgrade a guest account and keep its existing logs, or use **Sign in** to open a different account. Open **Settings** from the dashboard or analytics header to customize tasks, categories, weights, task order, active routine blocks, office weekdays, and sleep target. Settings are applied when a new daily log is created; existing daily logs retain their original task and office-day snapshots. A swap is logged with its alternative and receives 50% of the task's weight; done receives full credit and missed receives none.

## Checks

```powershell
npm run typecheck
npm run lint
npm run build
```

## Schema reference

The SQL migration is the canonical schema. In brief:

- `user_settings`: Auth user ID, target sleep hours (`5.5` by default), creation time.
- `user_task_templates`: Per-user task name, category, weight, active flag, and display order for future daily plans.
- `daily_logs`: Auth user, unique user/date, sleep hours, office flag, weighted score, and check-in/plan markers.
- `daily_tasks`: Daily task snapshots with task name, category (`fitness`, `dsa`, `career`, `work`), status (`done`, `swapped`, `missed`), optional substitution note, weight, and display order.

All user data is protected by row-level security. The application uses only the anon key and user-scoped sessions; no privileged server key is needed. Email confirmation redirects back to `/dashboard`; make sure that URL is allowed in the Supabase project's **Authentication → URL Configuration**.
