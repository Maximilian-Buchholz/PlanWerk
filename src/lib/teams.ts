import { notifyUsers } from "./friends";
import { supabase } from "./supabase";
import type { Profile } from "@/types/tasks";

export type Team = {
  id: string;
  name: string;
  ownerId: string;
  members: Profile[];
};

/**
 * Teams (friend groups) visible to the current user — both teams they own and
 * teams they were added to as a member. RLS scopes this by `auth.uid()`, so
 * no explicit filter is needed here.
 */
export async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, owner_id, team_members(profiles(id, full_name, avatar_color))")
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    members: (row.team_members ?? []).map((entry: any) => entry.profiles).filter(Boolean),
  }));
}

export async function createTeam(input: {
  ownerId: string;
  ownerName: string | null;
  name: string;
  memberIds: string[];
}): Promise<Team> {
  const { data: team, error } = await supabase
    .from("teams")
    .insert({ owner_id: input.ownerId, name: input.name })
    .select("id, name, owner_id")
    .single();
  if (error) throw error;

  // The owner counts as a member too — otherwise they'd be invisible in the
  // team's own member list (e.g. to the people they just added).
  const memberIds = [...new Set([...input.memberIds, input.ownerId])];
  const { error: membersError } = await supabase
    .from("team_members")
    .insert(memberIds.map((userId) => ({ team_id: team.id, user_id: userId })));
  if (membersError) {
    // Don't leave an empty team behind when the member rows could not be written.
    await supabase.from("teams").delete().eq("id", team.id);
    throw membersError;
  }

  await notifyUsers({
    recipientIds: input.memberIds,
    senderId: input.ownerId,
    type: "team_added",
    title: `${input.ownerName ?? "Jemand"} hat dich zum Team „${input.name}“ hinzugefügt`,
  });

  return { id: team.id, name: team.name, ownerId: team.owner_id, members: [] };
}

export async function deleteTeam(teamId: string) {
  const { data, error } = await supabase.from("teams").delete().eq("id", teamId).select("id");
  if (error) throw error;
  // Row-level security turns a forbidden delete into "0 rows", not an error.
  if (!data || data.length === 0) {
    throw new Error("Team konnte nicht gelöscht werden. Fehlt die Löschberechtigung in Supabase?");
  }
}
