# APEXTrack

A personal execution dashboard for tracking routines, fitness, DSA practice, side-hustle work, sleep, and hybrid office days.

## Features

- Daily weighted task check-ins with done, swapped, and missed outcomes.
- Substitution notes for flexible routine tracking.
- Custom tasks, task categories, task weights, and routine ordering.
- Per-user office weekdays and sleep targets.
- Four-week consistency analytics and sleep/output insights.
- Supabase authentication with guest-to-account progress preservation.

## Getting started

1. Install Node.js 18.17 or later.
2. Copy `.env.example` to `.env.local` and set the Supabase URL and anon key.
3. Apply the SQL migrations in `supabase/migrations` in timestamp order. For existing installations, apply pending migrations only.
4. Enable Email and Anonymous sign-ins in Supabase Authentication.
5. Run `npm install`, then `npm run dev`.

See [README.setup.md](./README.setup.md) for the detailed Supabase, environment, and validation instructions.
