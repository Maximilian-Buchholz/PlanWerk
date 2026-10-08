import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { InboxScreen } from '@/components/inbox-screen';
import { getCurrentProfile, getCurrentUserId } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import {
  deleteNotifications,
  fetchNotifications,
  fetchSentMessages,
  markNotificationRead,
  respondToFriendRequest,
  type AppNotification,
} from '@/lib/friends';
import type { Profile } from '@/types/tasks';

export default function PostfachRoute() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Profile | undefined>(undefined);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [sentMessages, setSentMessages] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      const [profile, items, sent] = await Promise.all([
        getCurrentProfile(),
        fetchNotifications(userId),
        fetchSentMessages(userId),
      ]);
      setLoadError(null);
      setCurrentUser(profile ?? undefined);
      setNotifications(items);
      setSentMessages(sent);
    } catch (error) {
      console.error("Postfach konnte nicht geladen werden:", error);
      setLoadError(getErrorMessage(error, "Postfach konnte nicht geladen werden."));
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

  async function handleRespond(notification: AppNotification, accept: boolean) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
      await respondToFriendRequest({
        notification,
        accept,
        currentUserId: userId,
        currentUserName: currentUser?.full_name ?? null,
      });
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      );
    } catch (error) {
      console.error("Antwort konnte nicht gespeichert werden:", error);
    }
  }

  return (
    <InboxScreen
      currentUser={currentUser}
      notifications={notifications}
      sentMessages={sentMessages}
      loadError={loadError}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onBack={() => router.back()}
      onPressAvatar={() => router.push('/profile')}
      onOpenNotification={async (notificationId) => {
        const notification = notifications.find((item) => item.id === notificationId);
        if (!notification || notification.isRead) return;
        setNotifications((current) =>
          current.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)),
        );
        try {
          await markNotificationRead(notificationId);
        } catch (error) {
          console.error("Nachricht konnte nicht als gelesen markiert werden:", error);
        }
      }}
      onAcceptFriendRequest={(notification) => handleRespond(notification, true)}
      onDeclineFriendRequest={(notification) => handleRespond(notification, false)}
      onDeleteNotifications={async (ids) => {
        const previous = notifications;
        setNotifications((current) => current.filter((item) => !ids.includes(item.id)));
        try {
          await deleteNotifications(ids);
        } catch (error) {
          console.error("Nachrichten konnten nicht gelöscht werden:", error);
          setNotifications(previous);
        }
      }}
    />
  );
}
