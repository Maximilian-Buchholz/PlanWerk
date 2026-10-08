import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { TeamsScreen } from '@/components/teams-screen';
import { getCurrentProfile, getCurrentUserId } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { fetchFriends, fetchPendingSentRequests, removeFriend, searchUserByEmail, sendFriendRequest } from '@/lib/friends';
import { useOnlineUserIds } from '@/lib/presence';
import { createTeam, deleteTeam, fetchTeams, type Team } from '@/lib/teams';
import type { Profile } from '@/types/tasks';

export default function TeamsRoute() {
  const router = useRouter();
  const onlineUserIds = useOnlineUserIds();
  const [currentUser, setCurrentUser] = useState<Profile | undefined>(undefined);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [pending, setPending] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      const [profile, friendsList, pendingList, teamsList] = await Promise.all([
        getCurrentProfile(),
        fetchFriends(userId),
        fetchPendingSentRequests(userId),
        fetchTeams(),
      ]);
      setLoadError(null);
      setCurrentUser(profile ?? undefined);
      setFriends(friendsList);
      setPending(pendingList);
      setTeams(teamsList);
    } catch (error) {
      console.error("Teams konnten nicht geladen werden:", error);
      setLoadError(getErrorMessage(error, "Teams konnten nicht geladen werden."));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <TeamsScreen
      currentUser={currentUser}
      friends={friends}
      onlineUserIds={onlineUserIds}
      pendingSentRequests={pending}
      teams={teams}
      loadError={loadError}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onBack={() => router.back()}
      onPressAvatar={() => router.push('/profile')}
      onSearchByEmail={(email) => searchUserByEmail(email)}
      onSendRequest={async (profile) => {
        const userId = await getCurrentUserId();
        if (!userId) return;
        await sendFriendRequest({
          requesterId: userId,
          requesterName: currentUser?.full_name ?? null,
          addresseeId: profile.id,
        });
        setPending((current) => [...current, profile]);
      }}
      onMessageFriend={(friend) =>
        router.push({
          pathname: '/message/[friendId]',
          params: {
            friendId: friend.id,
            friendName: friend.full_name ?? '',
            friendColor: friend.avatar_color,
          },
        })
      }
      onCreateTeam={async ({ name, memberIds }) => {
        const userId = await getCurrentUserId();
        if (!userId) return;
        await createTeam({ ownerId: userId, ownerName: currentUser?.full_name ?? null, name, memberIds });
        await load();
      }}
      onRemoveFriend={async (friend) => {
        const userId = await getCurrentUserId();
        if (!userId) return;
        const previous = friends;
        setFriends((current) => current.filter((item) => item.id !== friend.id));
        try {
          await removeFriend(userId, friend.id);
        } catch (error) {
          console.error("Freund konnte nicht entfernt werden:", error);
          setFriends(previous);
          setLoadError(getErrorMessage(error, "Freund konnte nicht entfernt werden."));
        }
      }}
      onDeleteTeam={async (teamId) => {
        const previous = teams;
        setTeams((current) => current.filter((team) => team.id !== teamId));
        try {
          await deleteTeam(teamId);
        } catch (error) {
          console.error("Team konnte nicht gelöscht werden:", error);
          setTeams(previous);
        }
      }}
    />
  );
}
