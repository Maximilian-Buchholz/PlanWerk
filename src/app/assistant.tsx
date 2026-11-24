import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { AssistantScreen } from '@/components/assistant-screen';
import { useAssistantChat, type FriendDisambiguation, type ProjectDraft } from '@/lib/assistant-chat-context';
import { getCurrentProfile, getCurrentUserId } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { fetchFriends, removeFriend, searchUserByEmail, sendDirectMessage, sendFriendRequest } from '@/lib/friends';
import {
  extractDueDateReply,
  extractMentionedFriends,
  extractTaskIntent,
  extractTaskPriorities,
} from '@/lib/ollama';
import { createProject, createTask, deleteProject, fetchProjectsOverview, type ProjectSummary } from '@/lib/tasks';
import type { Profile } from '@/types/tasks';

function findProject(projects: ProjectSummary[], name: string | null): ProjectSummary | null {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  return (
    projects.find((project) => project.name.toLowerCase() === lower) ??
    projects.find((project) => project.name.toLowerCase().includes(lower)) ??
    null
  );
}

function findFriend(friends: Profile[], name: string | null): Profile | null {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  return (
    friends.find((friend) => friend.full_name?.toLowerCase() === lower) ??
    friends.find((friend) => friend.full_name?.toLowerCase().includes(lower)) ??
    null
  );
}

/** All friends matching a (possibly partial, e.g. just a first name) name — used to detect ambiguity. */
function findFriendCandidates(friends: Profile[], name: string | null): Profile[] {
  if (!name) return [];
  const lower = name.trim().toLowerCase();
  const exact = friends.filter((friend) => friend.full_name?.toLowerCase() === lower);
  if (exact.length > 0) return exact;
  return friends.filter((friend) => friend.full_name?.toLowerCase().includes(lower));
}

/** Resolves a disambiguation reply ("Max Müller" or "1"/"2"/…) against the offered candidates. */
function pickDisambiguated(candidates: Profile[], prompt: string): Profile | null {
  const lower = prompt.trim().toLowerCase();
  const numberMatch = lower.match(/^(\d+)/);
  if (numberMatch) {
    const candidate = candidates[Number.parseInt(numberMatch[1], 10) - 1];
    if (candidate) return candidate;
  }
  return candidates.find((candidate) => candidate.full_name && lower.includes(candidate.full_name.toLowerCase())) ?? null;
}

/** Ground truth from the real `is_do_not_disturb`/`is_out_of_office` flags — never let the model state this itself. */
function describeFriendStatus(friend: Profile): string {
  if (friend.is_do_not_disturb) {
    return `${friend.full_name} hat aktuell "Nicht stören" aktiviert und ist wahrscheinlich nicht erreichbar.`;
  }
  if (friend.is_out_of_office) {
    return `${friend.full_name} ist aktuell als außer Haus markiert und wahrscheinlich nicht erreichbar.`;
  }
  return `${friend.full_name} ist aktuell erreichbar.`;
}

function isCancelPhrase(prompt: string): boolean {
  const lower = prompt.trim().toLowerCase();
  return ["abbrech", "abbruch", "stop", "vergiss es", "egal, lass"].some((needle) => lower.includes(needle));
}

let messageCounter = 0;
function nextId(): string {
  messageCounter += 1;
  return `m${Date.now()}-${messageCounter}`;
}

export default function AssistantRoute() {
  const router = useRouter();
  const {
    messages,
    setMessages,
    projectDraft,
    setProjectDraft,
    friendDisambiguation,
    setFriendDisambiguation,
    actionLog,
    addActionLog,
  } = useAssistantChat();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const userId = await getCurrentUserId();
          if (!userId) return;
          const [overview, friendsList] = await Promise.all([
            fetchProjectsOverview(userId),
            fetchFriends(userId),
          ]);
          if (cancelled) return;
          setProjects(overview);
          setFriends(friendsList);
        } catch (error) {
          console.error('Projekte/Freunde konnten nicht geladen werden:', error);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  function pushAssistantText(text: string) {
    setMessages((current) => [...current, { id: nextId(), role: 'assistant', text }]);
  }

  async function handleSend(prompt: string) {
    setLoadError(null);
    setMessages((current) => [...current, { id: nextId(), role: 'user', text: prompt }]);
    setIsThinking(true);

    try {
      if (friendDisambiguation) {
        if (isCancelPhrase(prompt)) {
          setFriendDisambiguation(null);
          pushAssistantText('Alles klar, abgebrochen.');
          return;
        }
        const chosen = pickDisambiguated(friendDisambiguation.candidates, prompt);
        if (!chosen) {
          pushAssistantText(
            `Das habe ich nicht verstanden. Wen meinst du: ${friendDisambiguation.candidates
              .map((candidate) => candidate.full_name)
              .join(', ')}?`,
          );
          return;
        }
        setFriendDisambiguation(null);
        executeFriendAction(chosen, friendDisambiguation.action);
        return;
      }

      if (projectDraft) {
        if (isCancelPhrase(prompt)) {
          setProjectDraft(null);
          pushAssistantText('Alles klar, abgebrochen.');
          return;
        }
        await advanceProjectWizard(prompt);
        return;
      }

      const intent = await extractTaskIntent({
        prompt,
        projectNames: projects.map((project) => project.name),
        friendNames: friends.map((friend) => friend.full_name).filter((name): name is string => Boolean(name)),
      });

      if (intent.action === 'create_project' && intent.projectName) {
        const taskTitles = intent.taskTitles ?? [];
        const draft: ProjectDraft = {
          name: intent.projectName,
          taskTitles,
          dueDate: null,
          participantIds: [],
          participantNames: [],
          priorities: {},
          step: 'due_date',
          existingProjectId: null,
        };
        setProjectDraft(draft);
        pushAssistantText(
          `Alles klar! Bis wann soll „${draft.name}“ abgeschlossen sein? (z. B. „in 2 Wochen“ oder „kein Datum“)`,
        );
        return;
      }

      if (intent.action === 'add_tasks' && intent.taskTitles && intent.taskTitles.length > 0) {
        const matchedProject = findProject(projects, intent.projectName);
        if (matchedProject) {
          const draft: ProjectDraft = {
            name: matchedProject.name,
            taskTitles: intent.taskTitles,
            dueDate: null,
            participantIds: [],
            participantNames: [],
            priorities: {},
            step: 'priority',
            existingProjectId: matchedProject.id,
          };
          setProjectDraft(draft);
          askForPriorities(draft);
          return;
        }
      }

      if (intent.action === 'friend_status') {
        const candidates = findFriendCandidates(friends, intent.friendName);
        if (candidates.length > 1) {
          setFriendDisambiguation({ candidates, action: { kind: 'friend_status' } });
          pushAssistantText(
            `Es gibt mehrere Freunde namens „${intent.friendName}“: ${candidates
              .map((candidate) => candidate.full_name)
              .join(', ')}. Wen meinst du?`,
          );
          return;
        }
        const matchedFriend = candidates[0] ?? null;
        const text = matchedFriend
          ? describeFriendStatus(matchedFriend)
          : `Ich kenne niemanden namens „${intent.friendName ?? '?'}“ in deiner Freundesliste.`;
        pushAssistantText(text);
        return;
      }

      if (intent.action === 'send_message' && intent.friendName && intent.messageBody) {
        const candidates = findFriendCandidates(friends, intent.friendName);
        if (candidates.length === 0) {
          pushAssistantText(`Ich kenne niemanden namens „${intent.friendName}“ in deiner Freundesliste.`);
          return;
        }
        if (candidates.length > 1) {
          setFriendDisambiguation({ candidates, action: { kind: 'send_message', messageBody: intent.messageBody } });
          pushAssistantText(
            `Es gibt mehrere Freunde namens „${intent.friendName}“: ${candidates
              .map((candidate) => candidate.full_name)
              .join(', ')}. Wen meinst du?`,
          );
          return;
        }
        pushPendingMessage(candidates[0], intent.messageBody, intent.message);
        return;
      }

      if (intent.action === 'add_friend' && intent.email) {
        try {
          const found = await searchUserByEmail(intent.email);
          if (!found) {
            pushAssistantText(`Ich konnte niemanden mit der E-Mail „${intent.email}“ finden.`);
            return;
          }
          setMessages((current) => [
            ...current,
            {
              id: nextId(),
              role: 'assistant',
              text: intent.message,
              pendingFriendAdd: { targetId: found.id, targetName: found.full_name ?? intent.email ?? 'Unbekannt' },
            },
          ]);
        } catch (error) {
          pushAssistantText(`⚠️ ${getErrorMessage(error, 'Die Suche ist fehlgeschlagen.')}`);
        }
        return;
      }

      if (intent.action === 'remove_friend' && intent.friendName) {
        const candidates = findFriendCandidates(friends, intent.friendName);
        if (candidates.length === 0) {
          pushAssistantText(`Ich kenne niemanden namens „${intent.friendName}“ in deiner Freundesliste.`);
          return;
        }
        if (candidates.length > 1) {
          setFriendDisambiguation({ candidates, action: { kind: 'remove_friend' } });
          pushAssistantText(
            `Es gibt mehrere Freunde namens „${intent.friendName}“: ${candidates
              .map((candidate) => candidate.full_name)
              .join(', ')}. Wen meinst du?`,
          );
          return;
        }
        pushPendingFriendRemove(candidates[0], intent.message);
        return;
      }

      if (intent.action === 'delete_project') {
        const lower = intent.projectName?.trim().toLowerCase();
        const matchedProject = lower ? projects.find((project) => project.name.toLowerCase() === lower) : null;
        if (!matchedProject) {
          pushAssistantText('Welches Projekt soll gelöscht werden? Nenne bitte den genauen Namen.');
          return;
        }
        setMessages((current) => [
          ...current,
          {
            id: nextId(),
            role: 'assistant',
            text: `Projekt „${matchedProject.name}“ endgültig löschen?`,
            pendingProjectDelete: {
              projectId: matchedProject.id,
              projectName: matchedProject.name,
              taskCount: matchedProject.totalTasks,
            },
          },
        ]);
        return;
      }

      if (intent.action === 'create_task' && intent.title) {
        const matchedProject = findProject(projects, intent.projectName);
        if (matchedProject) {
          setMessages((current) => [
            ...current,
            {
              id: nextId(),
              role: 'assistant',
              text: intent.message,
              pendingTask: {
                title: intent.title as string,
                projectName: matchedProject.name,
                dueDate: intent.dueDate,
                priority: intent.priority,
              },
            },
          ]);
          return;
        }
      }

      pushAssistantText(intent.message);
    } catch (error) {
      console.error('Ollama-Anfrage fehlgeschlagen:', error);
      const message = getErrorMessage(error, 'Der Assistent ist gerade nicht erreichbar.');
      setLoadError(message);
      pushAssistantText(`⚠️ ${message}`);
    } finally {
      setIsThinking(false);
    }
  }

  async function advanceProjectWizard(prompt: string) {
    if (!projectDraft) return;

    if (projectDraft.step === 'due_date') {
      const dueDate = await extractDueDateReply(prompt);
      const next: ProjectDraft = { ...projectDraft, dueDate, step: 'participants' };
      setProjectDraft(next);
      pushAssistantText(
        friends.length > 0
          ? 'Soll noch jemand aus deiner Freundesliste am Projekt teilnehmen? Nenn Namen, oder schreib „niemand“.'
          : 'Du hast noch keine Freunde hinzugefügt, daher mache ich hier ohne Teilnehmer weiter.',
      );
      if (friends.length === 0) {
        await advanceFromParticipants(next, []);
      }
      return;
    }

    if (projectDraft.step === 'participants') {
      const names = await extractMentionedFriends(
        prompt,
        friends.map((friend) => friend.full_name).filter((name): name is string => Boolean(name)),
      );
      await advanceFromParticipants(projectDraft, names);
      return;
    }

    if (projectDraft.step === 'disambiguate_participant') {
      const candidates = projectDraft.ambiguousCandidates ?? [];
      const chosen = pickDisambiguated(candidates, prompt);
      if (!chosen) {
        pushAssistantText(`Das habe ich nicht verstanden. Wen meinst du: ${candidates.map((c) => c.full_name).join(', ')}?`);
        return;
      }
      resolveParticipants(
        projectDraft,
        projectDraft.pendingNames ?? [],
        [...projectDraft.participantIds, chosen.id],
        [...projectDraft.participantNames, chosen.full_name ?? 'Unbekannt'],
      );
      return;
    }

    if (projectDraft.step === 'priority') {
      const priorities =
        projectDraft.taskTitles.length > 0
          ? await extractTaskPriorities(prompt, projectDraft.taskTitles)
          : {};
      const next: ProjectDraft = { ...projectDraft, priorities, step: 'confirm' };
      setProjectDraft(null);
      pushProjectProposal(next);
    }
  }

  function askForPriorities(draft: ProjectDraft) {
    pushAssistantText(
      `Welche Priorität sollen die Tasks bekommen? Du kannst eine für alle nennen (z. B. „mittel“) oder einzeln ` +
        `(z. B. „${draft.taskTitles[0]} hoch${draft.taskTitles[1] ? `, ${draft.taskTitles[1]} niedrig` : ''}“).`,
    );
  }

  async function advanceFromParticipants(draft: ProjectDraft, mentionedNames: string[]) {
    resolveParticipants(draft, mentionedNames, draft.participantIds, draft.participantNames);
  }

  /** Resolves mentioned names one by one, pausing to ask which friend is meant whenever a name is ambiguous. */
  function resolveParticipants(
    draft: ProjectDraft,
    pendingNames: string[],
    resolvedIds: string[],
    resolvedNames: string[],
  ) {
    if (pendingNames.length === 0) {
      const next: ProjectDraft = {
        ...draft,
        participantIds: resolvedIds,
        participantNames: resolvedNames,
        step: 'priority',
        pendingNames: undefined,
        ambiguousCandidates: null,
      };

      if (next.taskTitles.length === 0) {
        setProjectDraft(null);
        pushProjectProposal({ ...next, priorities: {} });
        return;
      }

      setProjectDraft(next);
      askForPriorities(next);
      return;
    }

    const [name, ...rest] = pendingNames;
    const candidates = findFriendCandidates(friends, name);

    if (candidates.length > 1) {
      setProjectDraft({
        ...draft,
        step: 'disambiguate_participant',
        pendingNames: rest,
        participantIds: resolvedIds,
        participantNames: resolvedNames,
        ambiguousCandidates: candidates,
      });
      pushAssistantText(
        `Es gibt mehrere Freunde namens „${name}“: ${candidates.map((candidate) => candidate.full_name).join(', ')}. Wen meinst du?`,
      );
      return;
    }

    const match = candidates[0] ?? null;
    resolveParticipants(
      draft,
      rest,
      match ? [...resolvedIds, match.id] : resolvedIds,
      match ? [...resolvedNames, match.full_name ?? 'Unbekannt'] : resolvedNames,
    );
  }

  function pushProjectProposal(draft: ProjectDraft) {
    setMessages((current) => [
      ...current,
      {
        id: nextId(),
        role: 'assistant',
        text: draft.existingProjectId
          ? `Diese Tasks zu „${draft.name}“ hinzufügen?`
          : `Hier ist der Vorschlag für „${draft.name}“:`,
        pendingProject: {
          name: draft.name,
          taskTitles: draft.taskTitles,
          priorities: draft.priorities,
          dueDate: draft.dueDate,
          participantNames: draft.participantNames,
          existingProjectId: draft.existingProjectId,
        },
      },
    ]);
  }

  function pushPendingMessage(friend: Profile, body: string, confirmText: string) {
    setMessages((current) => [
      ...current,
      {
        id: nextId(),
        role: 'assistant',
        text: confirmText,
        pendingMessage: { friendId: friend.id, friendName: friend.full_name ?? 'Unbekannt', body },
      },
    ]);
  }

  function pushPendingFriendRemove(friend: Profile, confirmText: string) {
    setMessages((current) => [
      ...current,
      {
        id: nextId(),
        role: 'assistant',
        text: confirmText,
        pendingFriendRemove: { friendId: friend.id, friendName: friend.full_name ?? 'Unbekannt' },
      },
    ]);
  }

  function executeFriendAction(friend: Profile, action: FriendDisambiguation['action']) {
    if (action.kind === 'friend_status') {
      pushAssistantText(describeFriendStatus(friend));
      return;
    }
    if (action.kind === 'send_message') {
      pushPendingMessage(friend, action.messageBody, `Diese Nachricht an ${friend.full_name} senden?`);
      return;
    }
    pushPendingFriendRemove(friend, `${friend.full_name} aus deiner Freundesliste entfernen?`);
  }

  async function handleConfirmMessage(messageId: string) {
    const target = messages.find((message) => message.id === messageId);
    const pending = target?.pendingMessage;
    if (!pending) return;

    const userId = await getCurrentUserId();
    if (!userId) return;
    const profile = await getCurrentProfile();

    try {
      await sendDirectMessage({
        senderId: userId,
        senderName: profile?.full_name ?? null,
        recipientId: pending.friendId,
        body: pending.body,
        viaAi: true,
      });

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.pendingMessage
            ? { ...message, pendingMessage: { ...message.pendingMessage, confirmed: true } }
            : message,
        ),
      );
      addActionLog('done', `Nachricht an ${pending.friendName} gesendet: „${pending.body}“`);
    } catch (error) {
      console.error('Nachricht konnte nicht gesendet werden:', error);
      addActionLog('failed', `Nachricht an ${pending.friendName} konnte nicht gesendet werden`);
      pushAssistantText(`⚠️ ${getErrorMessage(error, 'Nachricht konnte nicht gesendet werden.')}`);
    }
  }

  function handleDismissMessage(messageId: string) {
    const pending = messages.find((message) => message.id === messageId)?.pendingMessage;
    if (pending) addActionLog('cancelled', `Nachricht an ${pending.friendName} abgebrochen`);
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, pendingMessage: undefined } : message)),
    );
  }

  async function handleConfirmFriendAdd(messageId: string) {
    const target = messages.find((message) => message.id === messageId);
    const pending = target?.pendingFriendAdd;
    if (!pending) return;

    const userId = await getCurrentUserId();
    if (!userId) return;
    const profile = await getCurrentProfile();

    try {
      await sendFriendRequest({
        requesterId: userId,
        requesterName: profile?.full_name ?? null,
        addresseeId: pending.targetId,
      });

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.pendingFriendAdd
            ? { ...message, pendingFriendAdd: { ...message.pendingFriendAdd, confirmed: true } }
            : message,
        ),
      );
      addActionLog('done', `Freundschaftsanfrage an ${pending.targetName} gesendet`);
    } catch (error) {
      console.error('Freundschaftsanfrage fehlgeschlagen:', error);
      addActionLog('failed', `Freundschaftsanfrage an ${pending.targetName} fehlgeschlagen`);
      pushAssistantText(`⚠️ ${getErrorMessage(error, 'Freundschaftsanfrage konnte nicht gesendet werden.')}`);
    }
  }

  function handleDismissFriendAdd(messageId: string) {
    const pending = messages.find((message) => message.id === messageId)?.pendingFriendAdd;
    if (pending) addActionLog('cancelled', `Freundschaftsanfrage an ${pending.targetName} abgebrochen`);
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, pendingFriendAdd: undefined } : message)),
    );
  }

  async function handleConfirmFriendRemove(messageId: string) {
    const target = messages.find((message) => message.id === messageId);
    const pending = target?.pendingFriendRemove;
    if (!pending) return;

    const userId = await getCurrentUserId();
    if (!userId) return;

    try {
      await removeFriend(userId, pending.friendId);

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.pendingFriendRemove
            ? { ...message, pendingFriendRemove: { ...message.pendingFriendRemove, confirmed: true } }
            : message,
        ),
      );

      setFriends(await fetchFriends(userId));
      addActionLog('done', `${pending.friendName} aus der Freundesliste entfernt`);
    } catch (error) {
      console.error('Freund konnte nicht entfernt werden:', error);
      addActionLog('failed', `${pending.friendName} konnte nicht entfernt werden`);
      pushAssistantText(`⚠️ ${getErrorMessage(error, 'Freund konnte nicht entfernt werden.')}`);
    }
  }

  function handleDismissFriendRemove(messageId: string) {
    const pending = messages.find((message) => message.id === messageId)?.pendingFriendRemove;
    if (pending) addActionLog('cancelled', `Entfernen von ${pending.friendName} abgebrochen`);
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, pendingFriendRemove: undefined } : message,
      ),
    );
  }

  async function handleConfirmProjectDelete(messageId: string) {
    const target = messages.find((message) => message.id === messageId);
    const pending = target?.pendingProjectDelete;
    if (!pending) return;

    try {
      await deleteProject(pending.projectId);

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.pendingProjectDelete
            ? { ...message, pendingProjectDelete: { ...message.pendingProjectDelete, confirmed: true } }
            : message,
        ),
      );

      const userId = await getCurrentUserId();
      if (userId) setProjects(await fetchProjectsOverview(userId));
      pushAssistantText(`Projekt „${pending.projectName}“ wurde gelöscht.`);
      addActionLog('done', `Projekt „${pending.projectName}“ gelöscht (inkl. ${pending.taskCount} Task(s))`);
    } catch (error) {
      console.error('Projekt konnte nicht gelöscht werden:', error);
      addActionLog('failed', `Projekt „${pending.projectName}“ konnte nicht gelöscht werden`);
      pushAssistantText(`⚠️ ${getErrorMessage(error, 'Projekt konnte nicht gelöscht werden.')}`);
    }
  }

  function handleDismissProjectDelete(messageId: string) {
    const pending = messages.find((message) => message.id === messageId)?.pendingProjectDelete;
    if (pending) addActionLog('cancelled', `Löschen von Projekt „${pending.projectName}“ abgebrochen`);
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, pendingProjectDelete: undefined } : message,
      ),
    );
  }

  async function handleConfirmTask(messageId: string) {
    const target = messages.find((message) => message.id === messageId);
    const pending = target?.pendingTask;
    if (!pending) return;

    const matchedProject = findProject(projects, pending.projectName);
    if (!matchedProject) return;

    const userId = await getCurrentUserId();
    if (!userId) return;
    const profile = await getCurrentProfile();

    try {
      await createTask({
        projectId: matchedProject.id,
        phaseId: null,
        createdBy: userId,
        createdByName: profile?.full_name ?? null,
        title: pending.title,
        description: '',
        dueDate: pending.dueDate,
        priority: pending.priority,
        assigneeIds: [userId],
      });

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.pendingTask
            ? { ...message, pendingTask: { ...message.pendingTask, confirmed: true } }
            : message,
        ),
      );
      addActionLog('done', `Task „${pending.title}“ in Projekt „${matchedProject.name}“ erstellt`);
    } catch (error) {
      console.error('Task konnte nicht erstellt werden:', error);
      addActionLog('failed', `Task „${pending.title}“ konnte nicht erstellt werden`);
      pushAssistantText(`⚠️ ${getErrorMessage(error, 'Task konnte nicht erstellt werden.')}`);
    }
  }

  function handleDismissTask(messageId: string) {
    const pending = messages.find((message) => message.id === messageId)?.pendingTask;
    if (pending) addActionLog('cancelled', `Task „${pending.title}“ abgebrochen`);
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, pendingTask: undefined } : message)),
    );
  }

  async function handleConfirmProject(messageId: string) {
    const target = messages.find((message) => message.id === messageId);
    const pending = target?.pendingProject;
    if (!pending) return;

    const userId = await getCurrentUserId();
    if (!userId) return;
    const profile = await getCurrentProfile();

    try {
      const projectId = pending.existingProjectId
        ? pending.existingProjectId
        : (await createProject({ userId, name: pending.name, dueDate: pending.dueDate })).id;

      // participantIds were resolved during the wizard but not stored on the message —
      // re-resolve by name against the current friends list to keep ChatMessage data simple.
      const participantIds = pending.participantNames
        .map((name) => findFriend(friends, name)?.id)
        .filter((id): id is string => Boolean(id));

      for (const title of pending.taskTitles) {
        await createTask({
          projectId,
          phaseId: null,
          createdBy: userId,
          createdByName: profile?.full_name ?? null,
          title,
          description: '',
          dueDate: pending.dueDate,
          priority: pending.priorities[title] ?? 'medium',
          assigneeIds: [userId, ...participantIds],
        });
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.pendingProject
            ? { ...message, pendingProject: { ...message.pendingProject, confirmed: true } }
            : message,
        ),
      );

      const overview = await fetchProjectsOverview(userId);
      setProjects(overview);
      addActionLog(
        'done',
        pending.existingProjectId
          ? `${pending.taskTitles.length} Task(s) zu Projekt „${pending.name}“ hinzugefügt`
          : `Projekt „${pending.name}“ mit ${pending.taskTitles.length} Task(s) erstellt`,
      );
    } catch (error) {
      console.error('Projekt/Tasks konnten nicht erstellt werden:', error);
      addActionLog('failed', `Projekt „${pending.name}“ konnte nicht (vollständig) gespeichert werden`);
      pushAssistantText(`⚠️ ${getErrorMessage(error, 'Konnte nicht gespeichert werden.')}`);
    }
  }

  function handleDismissProject(messageId: string) {
    const pending = messages.find((message) => message.id === messageId)?.pendingProject;
    if (pending) addActionLog('cancelled', `Projekt „${pending.name}“ abgebrochen`);
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, pendingProject: undefined } : message,
      ),
    );
  }

  return (
    <AssistantScreen
      messages={messages}
      actionLog={actionLog}
      isThinking={isThinking}
      loadError={loadError}
      onBack={() => router.back()}
      onSend={handleSend}
      onConfirmTask={handleConfirmTask}
      onDismissTask={handleDismissTask}
      onConfirmProject={handleConfirmProject}
      onDismissProject={handleDismissProject}
      onConfirmMessage={handleConfirmMessage}
      onDismissMessage={handleDismissMessage}
      onConfirmFriendAdd={handleConfirmFriendAdd}
      onDismissFriendAdd={handleDismissFriendAdd}
      onConfirmFriendRemove={handleConfirmFriendRemove}
      onDismissFriendRemove={handleDismissFriendRemove}
      onConfirmProjectDelete={handleConfirmProjectDelete}
      onDismissProjectDelete={handleDismissProjectDelete}
    />
  );
}
