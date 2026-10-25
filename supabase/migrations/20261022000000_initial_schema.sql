create table if not exists public.user_settings (
  id uuid primary key references auth.users (id) on delete cascade,
  target_sleep_hours numeric(3, 1) not null default 5.5 check (target_sleep_hours > 0 and target_sleep_hours <= 24),
  office_days smallint[] not null default array[3, 4]::smallint[]
    check (cardinality(office_days) <= 7 and office_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  created_at timestamptz not null default now()
);

create table if not exists public.user_task_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_name text not null check (length(trim(task_name)) > 0 and length(task_name) <= 100),
  category text not null check (category in ('fitness', 'dsa', 'career', 'work')),
  weight numeric(5, 2) not null default 1 check (weight > 0 and weight <= 100),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, task_name)
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  sleep_hours numeric(4, 2) not null default 5.5 check (sleep_hours >= 0 and sleep_hours <= 24),
  is_office_day boolean not null default false,
  daily_score numeric(5, 2) not null default 0 check (daily_score >= 0 and daily_score <= 100),
  has_checkin boolean not null default false,
  tasks_seeded boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references public.daily_logs (id) on delete cascade,
  task_name text not null,
  category text not null check (category in ('fitness', 'dsa', 'career', 'work')),
  status text not null default 'missed' check (status in ('done', 'swapped', 'missed')),
  substitution_note text,
  weight numeric(5, 2) not null default 1 check (weight > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (daily_log_id, task_name),
  check (status = 'swapped' or substitution_note is null),
  check (status <> 'swapped' or length(trim(coalesce(substitution_note, ''))) > 0)
);

create index if not exists daily_logs_user_date_idx on public.daily_logs (user_id, date desc);
create index if not exists daily_tasks_daily_log_idx on public.daily_tasks (daily_log_id);
create index if not exists user_task_templates_user_order_idx on public.user_task_templates (user_id, sort_order);

alter table public.user_settings enable row level security;
alter table public.user_task_templates enable row level security;
alter table public.daily_logs enable row level security;
alter table public.daily_tasks enable row level security;

create policy "Users manage their own settings"
  on public.user_settings for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users manage their own routine templates"
  on public.user_task_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own daily logs"
  on public.daily_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage tasks for their own logs"
  on public.daily_tasks for all
  using (
    exists (
      select 1 from public.daily_logs
      where daily_logs.id = daily_tasks.daily_log_id
        and daily_logs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.daily_logs
      where daily_logs.id = daily_tasks.daily_log_id
        and daily_logs.user_id = auth.uid()
    )
  );

create or replace function public.create_user_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (id) values (new.id) on conflict (id) do nothing;
  insert into public.user_task_templates (user_id, task_name, category, weight, sort_order)
  values
    (new.id, 'Morning gym', 'fitness', 1, 0),
    (new.id, 'Jog or walk', 'fitness', 0.75, 1),
    (new.id, 'DSA practice', 'dsa', 1.25, 2),
    (new.id, 'Side hustle', 'career', 1.25, 3),
    (new.id, 'Focused work', 'work', 1.5, 4)
  on conflict (user_id, task_name) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_settings on auth.users;
create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row execute procedure public.create_user_settings();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_settings, public.user_task_templates, public.daily_logs, public.daily_tasks to authenticated;
