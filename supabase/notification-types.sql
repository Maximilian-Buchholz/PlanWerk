-- Erlaubt den Benachrichtigungstyp "team_added" (und alle Typen, die die App sendet).
-- Im Supabase SQL Editor ausführen.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'friend_request',
    'friend_request_accepted',
    'direct_message',
    'task_assigned',
    'task_updated',
    'team_added'
  ));
