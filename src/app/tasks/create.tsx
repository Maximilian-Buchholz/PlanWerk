import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { CreateTaskScreen } from '@/components/create-task-screen';
import { getCurrentProfile, getCurrentUserId } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { fetchFriends } from '@/lib/friends';
import { fetchTeams, type Team } from '@/lib/teams';
import { createTask, fetchProjectWithTasks, updateTask, type ProjectWithTasks } from '@/lib/tasks';
import type { Profile } from '@/types/tasks';

export default function CreateTaskRoute() {
  const router = useRouter();
  const { projectId, taskId } = useLocalSearchParams<{ projectId: string; taskId?: string }>();
  const [context, setContext] = useState<ProjectWithTasks | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [contextError, setContextError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        try {
          const userId = await getCurrentUserId();
          const [projectContext, friendsList, teamsList] = await Promise.all([
            fetchProjectWithTasks(projectId),
            userId ? fetchFriends(userId) : Promise.resolve([]),
            fetchTeams(),
          ]);
          if (cancelled) return;
          setContext(projectContext);
          setFriends(friendsList);
          setTeams(teamsList);
          setContextError(null);
        } catch (error) {
          if (cancelled) return;
          console.error("Projekt-Kontext konnte nicht geladen werden:", error);
          setContextError(getErrorMessage(error, "Projekt konnte nicht geladen werden."));
        }
      }

      load();
      return () => {
        cancelled = true;
      };
    }, [projectId]),
  );

  const editingTask = taskId ? context?.tasks.find((task) => task.id === taskId) ?? null : null;

  return (
    <CreateTaskScreen
      // The form copies initialValues into state once on mount, so remount when the task being edited has loaded.
      key={taskId ? (editingTask ? 'edit-loaded' : 'edit-loading') : 'create'}
      mode={taskId ? 'edit' : 'create'}
      project={
        context?.project
          ? { id: context.project.id, name: context.project.name, dueDate: context.project.due_date }
          : { id: '', name: 'Kein Projekt gefunden' }
      }
      projectMembers={context?.members ?? []}
      friends={friends}
      teams={teams}
      phases={context?.phases ?? []}
      initialValues={
        editingTask
          ? {
              title: editingTask.title,
              description: editingTask.description ?? '',
              dueDate: editingTask.due_date,
              priority: editingTask.priority,
              phaseId: editingTask.phase_id,
              assigneeIds: editingTask.assignees.map((assignee) => assignee.id),
            }
          : undefined
      }
      loadError={contextError}
      onBack={() => router.back()}
      onSubmit={async ({ title, description, dueDate, priority, projectId: submittedProjectId, phaseId, assigneeIds }) => {
        const userId = await getCurrentUserId();
        if (!userId || !submittedProjectId) return;
        const profile = await getCurrentProfile();

        if (taskId) {
          await updateTask(taskId, {
            projectId: submittedProjectId,
            editedBy: userId,
            editedByName: profile?.full_name ?? null,
            title,
            description,
            dueDate,
            priority,
            phaseId,
            assigneeIds,
          });
        } else {
          await createTask({
            projectId: submittedProjectId,
            phaseId,
            createdBy: userId,
            createdByName: profile?.full_name ?? null,
            title,
            description,
            dueDate,
            priority,
            assigneeIds,
          });
        }

        router.back();
      }}
    />
  );
}
