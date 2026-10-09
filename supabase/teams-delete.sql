-- Teams löschen: Besitzer dürfen ihr Team (und dessen Mitglieder-Einträge) entfernen.
-- Einmalig im Supabase SQL Editor ausführen; jede Anweisung einzeln, falls eine
-- Regel schon existiert ("already exists" ist dann harmlos).

create policy "teams_delete_owner"
  on public.teams
  for delete
  using (auth.uid() = owner_id);

create policy "team_members_delete_owner"
  on public.team_members
  for delete
  using (exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));
