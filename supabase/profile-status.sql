-- Status-Flags für "Nicht stören" und "Out of office", sichtbar für Freunde.
-- Einmalig im Supabase SQL Editor ausführen.
alter table public.profiles
  add column if not exists is_do_not_disturb boolean not null default false,
  add column if not exists is_out_of_office boolean not null default false;
