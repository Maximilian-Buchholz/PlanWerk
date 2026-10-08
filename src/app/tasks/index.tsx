import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { TasksOverviewScreen } from '@/components/tasks-overview-screen';
import { getCurrentProfile, getCurrentUserId } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { deleteTask, fetchDashboardTasks, fetchProjectsOverview, setTaskDone, type ProjectSummary } from '@/lib/tasks';
import type { Profile, TaskWithRelations } from '@/types/tasks';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TasksRoute() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Profile | undefined>(undefined);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      const [profile, dashboard, projectsOverview] = await Promise.all([
        getCurrentProfile(),
        fetchDashboardTasks(userId),
        fetchProjectsOverview(userId),
      ]);
      setLoadError(null);
      setCurrentUser(profile ?? undefined);
      setTasks(dashboard.tasks);
      setProjects(projectsOverview);
    } catch (error) {
      console.error("Tasks-Dashboard konnte nicht geladen werden:", error);
      setLoadError(getErrorMessage(error, "Tasks konnten nicht geladen werden."));
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

  const today = todayIsoDate();
  const dueTodayTasks = tasks.filter((task) => !task.is_done && task.due_date === today);
  const openTasksCount = tasks.filter((task) => !task.is_done).length;

  async function handleToggleDone(taskId: string) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;

    const nextDone = !task.is_done;
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === taskId ? { ...candidate, is_done: nextDone } : candidate,
      ),
    );

    try {
      await setTaskDone(taskId, nextDone);
    } catch {
      // Revert on failure — the update above was optimistic.
      setTasks((current) =>
        current.map((candidate) =>
          candidate.id === taskId ? { ...candidate, is_done: !nextDone } : candidate,
        ),
      );
    }
  }

  async function handleDeleteTask(taskId: string) {
    const previous = tasks;
    setTasks((current) => current.filter((candidate) => candidate.id !== taskId));

    try {
      await deleteTask(taskId);
    } catch {
      // Revert on failure.
      setTasks(previous);
    }
  }

  return (
    <TasksOverviewScreen
      username={currentUser?.full_name ?? undefined}
      currentUser={currentUser}
      openTasksCount={openTasksCount}
      dueTodayCount={dueTodayTasks.length}
      dueTodayTasks={dueTodayTasks}
      projects={projects}
      loadError={loadError}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onCreateProject={() => router.push('/tasks/new-project')}
      onPressAvatar={() => router.push('/profile')}
      onOpenProject={(projectId) => router.push(`/tasks/${projectId}`)}
      onToggleDone={handleToggleDone}
      onDeleteTask={handleDeleteTask}
      onEditTask={(taskId) => {
        const task = tasks.find((candidate) => candidate.id === taskId);
        if (!task?.project) return;
        router.push({ pathname: '/tasks/create', params: { projectId: task.project.id, taskId } });
      }}
    />
  );
}
