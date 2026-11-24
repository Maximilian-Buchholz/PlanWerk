import { createContext, useCallback, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import type { ChatMessage } from "@/components/assistant-screen";
import type { Profile, Priority } from "@/types/tasks";

export type ProjectDraft = {
  name: string;
  taskTitles: string[];
  dueDate: string | null;
  participantIds: string[];
  participantNames: string[];
  priorities: Record<string, Priority>;
  step: "due_date" | "participants" | "priority" | "confirm" | "disambiguate_participant";
  /** Set when adding tasks to a project that already exists — skips creating a new project. */
  existingProjectId: string | null;
  /** Names still to resolve against the friends list — only used while disambiguating. */
  pendingNames?: string[];
  /** Candidates to choose from when a mentioned first name matched more than one friend. */
  ambiguousCandidates?: Profile[] | null;
};

/** Set when a friend name the user mentioned (for a message, removal, etc.) matched more than one friend. */
export type FriendDisambiguation = {
  candidates: Profile[];
  action:
    | { kind: "send_message"; messageBody: string }
    | { kind: "remove_friend" }
    | { kind: "friend_status" };
};

/** One line in the "Blackbox": something the assistant did (or was stopped from doing). */
export type ActionLogEntry = {
  id: string;
  at: number;
  status: "done" | "failed" | "cancelled";
  summary: string;
};

type AssistantChatState = {
  actionLog: ActionLogEntry[];
  addActionLog: (status: ActionLogEntry["status"], summary: string) => void;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  projectDraft: ProjectDraft | null;
  setProjectDraft: Dispatch<SetStateAction<ProjectDraft | null>>;
  friendDisambiguation: FriendDisambiguation | null;
  setFriendDisambiguation: Dispatch<SetStateAction<FriendDisambiguation | null>>;
};

const AssistantChatContext = createContext<AssistantChatState | null>(null);

/**
 * Holds the assistant chat's messages/wizard state at the root of the app
 * (outside the Stack), so switching bottom tabs — which remounts the
 * `/assistant` route — doesn't wipe the conversation.
 */
export function AssistantChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null);
  const [friendDisambiguation, setFriendDisambiguation] = useState<FriendDisambiguation | null>(null);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

  const addActionLog = useCallback((status: ActionLogEntry["status"], summary: string) => {
    const at = Date.now();
    setActionLog((current) => [...current, { id: `a${at}-${current.length}`, at, status, summary }]);
  }, []);

  return (
    <AssistantChatContext.Provider
      value={{
        actionLog,
        addActionLog,
        messages,
        setMessages,
        projectDraft,
        setProjectDraft,
        friendDisambiguation,
        setFriendDisambiguation,
      }}
    >
      {children}
    </AssistantChatContext.Provider>
  );
}

export function useAssistantChat(): AssistantChatState {
  const context = useContext(AssistantChatContext);
  if (!context) {
    throw new Error("useAssistantChat must be used within an AssistantChatProvider");
  }
  return context;
}
