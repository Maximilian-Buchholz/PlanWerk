-- Einmalig im Supabase SQL Editor ausführen.

-- 1) Freunde entfernen: beide Beteiligten dürfen die Freundschaft löschen.
create policy "friendships_delete_participants"
  on public.friendships
  for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- 2) Live-Badge im Postfach: Änderungen an notifications per Realtime senden.
alter publication supabase_realtime add table public.notifications;
