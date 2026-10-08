import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { CalendarScreen, type CalendarEntry } from '@/components/calendar-screen';
import { getCurrentProfile, getCurrentUserId } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { fetchDashboardTasks, fetchProjectsOverview } from '@/lib/tasks';
import type { Profile } from '@/types/tasks';

export default function CalendarRoute() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Profile | undefined>(undefined);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      const [profile, dashboard, projects] = await Promise.all([
        getCurrentProfile(),
        fetchDashboardTasks(userId),
        fetchProjectsOverview(userId),
      ]);
      setLoadError(null);
      setCurrentUser(profile ?? undefined);

      const taskEntries: CalendarEntry[] = dashboard.tasks
        .filter((task) => task.due_date)
        .map((task) => ({
          kind: 'task',
          id: task.id,
          date: task.due_date as string,
          title: task.title,
          projectId: task.project?.id ?? null,
          projectName: task.project?.name ?? null,
          priority: task.priority,
          isDone: task.is_done,
        }));

      const projectEntries: CalendarEntry[] = projects
        .filter((project) => project.dueDate)
        .map((project) => ({
          kind: 'project',
          id: project.id,
          date: project.dueDate as string,
          title: project.name,
        }));

      setEntries([...taskEntries, ...projectEntries]);
    } catch (error) {
      console.error('Kalender konnte nicht geladen werden:', error);
      setLoadError(getErrorMessage(error, 'Kalender konnte nicht geladen werden.'));
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
    <CalendarScreen
      currentUser={currentUser}
      entries={entries}
      loadError={loadError}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onPressAvatar={() => router.push('/profile')}
      onOpenProject={(projectId) => router.push(`/tasks/${projectId}`)}
    />
  );
}
