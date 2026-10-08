import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { ProjectDetailScreen } from '@/components/project-detail-screen';
import { getErrorMessage } from '@/lib/errors';
import { deleteProject, deleteTask, fetchProjectWithTasks, setTaskDone, type ProjectWithTasks } from '@/lib/tasks';

export default function ProjectDetailRoute() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [data, setData] = useState<ProjectWithTasks | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchProjectWithTasks(projectId);
      setLoadError(null);
      setData(result);
    } catch (error) {
      console.error("Projekt konnte nicht geladen werden:", error);
      setLoadError(getErrorMessage(error, "Projekt konnte nicht geladen werden."));
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleToggleDone(taskId: string) {
    if (!data) return;
    const task = data.tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;

    const nextDone = !task.is_done;
    setData((current) =>
      current
        ? {
            ...current,
            tasks: current.tasks.map((candidate) =>
              candidate.id === taskId ? { ...candidate, is_done: nextDone } : candidate,
            ),
          }
        : current,
    );

    try {
      await setTaskDone(taskId, nextDone);
    } catch {
      setData((current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.map((candidate) =>
                candidate.id === taskId ? { ...candidate, is_done: !nextDone } : candidate,
              ),
            }
          : current,
      );
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!data) return;
    const previous = data;
    setData((current) =>
      current ? { ...current, tasks: current.tasks.filter((task) => task.id !== taskId) } : current,
    );

    try {
      await deleteTask(taskId);
    } catch {
      setData(previous);
    }
  }

  if (!data) {
    return null;
  }

  return (
    <ProjectDetailScreen
      project={data.project}
      members={data.members}
      tasks={data.tasks}
      loadError={loadError}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onBack={() => router.back()}
      onCreateTask={() => router.push({ pathname: '/tasks/create', params: { projectId } })}
      onEditTask={(taskId) => router.push({ pathname: '/tasks/create', params: { projectId, taskId } })}
      onToggleDone={handleToggleDone}
      onDeleteTask={handleDeleteTask}
      onDeleteProject={async (id) => {
        await deleteProject(id);
        router.replace('/tasks');
      }}
    />
  );
}
