-- Kommentare mit Likes und Aktivitäts-Verlauf für Tasks.
-- Im Supabase SQL Editor in einem Rutsch ausführen.
-- Voraussetzung: public.task_comments (id, task_id, user_id, content, created_at) existiert bereits.

-- Hilfsfunktion: Ist der angemeldete Nutzer Mitglied des Projekts, zu dem der Task gehört?
create or replace function public.is_task_project_member(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where t.id = p_task_id and pm.user_id = auth.uid()
  )
$$;

-- 1) Likes auf Kommentare
create table if not exists public.task_comment_likes (
  comment_id uuid not null references public.task_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.task_comment_likes enable row level security;

drop policy if exists "task_comment_likes_select" on public.task_comment_likes;
create policy "task_comment_likes_select" on public.task_comment_likes
  for select using (
    exists (
      select 1 from public.task_comments c
      where c.id = comment_id and public.is_task_project_member(c.task_id)
    )
  );

drop policy if exists "task_comment_likes_insert" on public.task_comment_likes;
create policy "task_comment_likes_insert" on public.task_comment_likes
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.task_comments c
      where c.id = comment_id and public.is_task_project_member(c.task_id)
    )
  );

drop policy if exists "task_comment_likes_delete" on public.task_comment_likes;
create policy "task_comment_likes_delete" on public.task_comment_likes
  for delete using (user_id = auth.uid());

-- 2) Verlauf ("Benachrichtigung" im Task): wer wurde hinzugefügt, wohin wurde verschoben, ...
create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in (
    'task_created', 'assignee_added', 'assignee_removed',
    'phase_changed', 'marked_done', 'marked_open'
  )),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists task_activity_task_id_idx on public.task_activity (task_id, created_at);

alter table public.task_activity enable row level security;

drop policy if exists "task_activity_select" on public.task_activity;
create policy "task_activity_select" on public.task_activity
  for select using (public.is_task_project_member(task_id));

drop policy if exists "task_activity_insert" on public.task_activity;
create policy "task_activity_insert" on public.task_activity
  for insert with check (actor_id = auth.uid() and public.is_task_project_member(task_id));

-- 3) Kommentare lesen/schreiben (zusätzlich zu evtl. vorhandenen Regeln)
drop policy if exists "task_comments_select_members" on public.task_comments;
create policy "task_comments_select_members" on public.task_comments
  for select using (public.is_task_project_member(task_id));

drop policy if exists "task_comments_insert_own" on public.task_comments;
create policy "task_comments_insert_own" on public.task_comments
  for insert with check (user_id = auth.uid() and public.is_task_project_member(task_id));

-- Supabase-API über die neuen Tabellen informieren (sonst: "Could not find the table ... in the schema cache").
notify pgrst, 'reload schema';
