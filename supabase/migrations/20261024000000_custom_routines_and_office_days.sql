alter table public.user_settings
  add column if not exists office_days smallint[] not null default array[3, 4]::smallint[];

alter table public.user_settings
  drop constraint if exists user_settings_office_days_check;

alter table public.user_settings
  add constraint user_settings_office_days_check
  check (
    cardinality(office_days) <= 7
    and office_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  );

alter table public.daily_logs
  add column if not exists tasks_seeded boolean not null default false;

alter table public.daily_tasks
  add column if not exists sort_order integer not null default 0;

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

create index if not exists user_task_templates_user_order_idx
  on public.user_task_templates (user_id, sort_order);

alter table public.user_task_templates enable row level security;

drop policy if exists "Users manage their own routine templates" on public.user_task_templates;
create policy "Users manage their own routine templates"
  on public.user_task_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.user_task_templates to authenticated;

insert into public.user_task_templates (user_id, task_name, category, weight, sort_order)
select settings.id, routine.task_name, routine.category, routine.weight, routine.sort_order
from public.user_settings as settings
cross join (
  values
    ('Morning gym', 'fitness', 1.00::numeric, 0),
    ('Jog or walk', 'fitness', 0.75::numeric, 1),
    ('DSA practice', 'dsa', 1.25::numeric, 2),
    ('Side hustle', 'career', 1.25::numeric, 3),
    ('Focused work', 'work', 1.50::numeric, 4)
) as routine(task_name, category, weight, sort_order)
on conflict (user_id, task_name) do nothing;

update public.daily_logs as logs
set tasks_seeded = true
where not logs.tasks_seeded
  and exists (
    select 1
    from public.daily_tasks as tasks
    where tasks.daily_log_id = logs.id
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
