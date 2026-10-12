import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { TaskThreadScreen } from '@/components/task-thread-screen';
import { getCurrentUserId } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import {
  addTaskComment,
  fetchTaskThread,
  setCommentLike,
  type ThreadEntry,
} from '@/lib/task-thread';

export default function TaskThreadRoute() {
  const router = useRouter();
  const { taskId, taskTitle } = useLocalSearchParams<{ taskId: string; taskTitle?: string }>();
  const [entries, setEntries] = useState<ThreadEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const currentUserId = await getCurrentUserId();
      setUserId(currentUserId);
      setEntries(await fetchTaskThread(taskId, currentUserId));
      setLoadError(null);
    } catch (error) {
      console.error('Kommentare konnten nicht geladen werden:', error);
      setLoadError(getErrorMessage(error, 'Kommentare konnten nicht geladen werden.'));
    }
  }, [taskId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSendComment(content: string) {
    if (!userId) return;
    await addTaskComment({ taskId, userId, content });
    await load();
  }

  async function handleToggleLike(commentId: string, liked: boolean) {
    if (!userId) return;
    const previous = entries;
    setEntries((current) =>
      current.map((entry) =>
        entry.kind === 'comment' && entry.id === commentId
          ? { ...entry, likedByMe: liked, likeCount: Math.max(0, entry.likeCount + (liked ? 1 : -1)) }
          : entry,
      ),
    );
    try {
      await setCommentLike({ commentId, userId, liked });
    } catch (error) {
      console.error('Like konnte nicht gespeichert werden:', error);
      setEntries(previous);
      setLoadError(getErrorMessage(error, 'Like konnte nicht gespeichert werden.'));
    }
  }

  return (
    <TaskThreadScreen
      taskTitle={taskTitle || 'Task'}
      entries={entries}
      loadError={loadError}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onBack={() => router.back()}
      onSendComment={handleSendComment}
      onToggleLike={handleToggleLike}
    />
  );
}
