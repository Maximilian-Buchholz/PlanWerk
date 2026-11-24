import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PriorityBadge } from "@/components/priority-badge";
import { Spacing } from "@/constants/theme";
import type { TaskIntent } from "@/lib/ollama";
import type { Palette } from "@/theme/colors";
import { useColors } from "@/theme/theme-context";

SplashScreen.preventAutoHideAsync().catch(() => {});

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pendingTask?: {
    title: string;
    projectName: string;
    dueDate: string | null;
    priority: TaskIntent["priority"];
    confirmed?: boolean;
  };
  pendingProject?: {
    name: string;
    taskTitles: string[];
    priorities: Record<string, TaskIntent["priority"]>;
    dueDate: string | null;
    participantNames: string[];
    /** Set when adding tasks to a project that already exists, instead of creating a new one. */
    existingProjectId?: string | null;
    confirmed?: boolean;
  };
  pendingMessage?: {
    friendId: string;
    friendName: string;
    body: string;
    confirmed?: boolean;
  };
  pendingFriendAdd?: {
    targetId: string;
    targetName: string;
    confirmed?: boolean;
  };
  pendingFriendRemove?: {
    friendId: string;
    friendName: string;
    confirmed?: boolean;
  };
  pendingProjectDelete?: {
    projectId: string;
    projectName: string;
    taskCount: number;
    confirmed?: boolean;
  };
};

export type AssistantScreenProps = {
  messages: ChatMessage[];
  isThinking?: boolean;
  loadError?: string | null;
  onBack?: () => void;
  onSend: (prompt: string) => Promise<void> | void;
  onConfirmTask: (messageId: string) => Promise<void> | void;
  onDismissTask: (messageId: string) => void;
  onConfirmProject: (messageId: string) => Promise<void> | void;
  onDismissProject: (messageId: string) => void;
  onConfirmMessage: (messageId: string) => Promise<void> | void;
  onDismissMessage: (messageId: string) => void;
  onConfirmFriendAdd: (messageId: string) => Promise<void> | void;
  onDismissFriendAdd: (messageId: string) => void;
  onConfirmFriendRemove: (messageId: string) => Promise<void> | void;
  onDismissFriendRemove: (messageId: string) => void;
  onConfirmProjectDelete: (messageId: string) => Promise<void> | void;
  onDismissProjectDelete: (messageId: string) => void;
};

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "Kein Datum";
  return new Date(`${dueDate}T00:00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type ActivePending =
  | { messageId: string; kind: "task"; data: NonNullable<ChatMessage["pendingTask"]> }
  | { messageId: string; kind: "project"; data: NonNullable<ChatMessage["pendingProject"]> }
  | { messageId: string; kind: "message"; data: NonNullable<ChatMessage["pendingMessage"]> }
  | { messageId: string; kind: "friend_add"; data: NonNullable<ChatMessage["pendingFriendAdd"]> }
  | { messageId: string; kind: "friend_remove"; data: NonNullable<ChatMessage["pendingFriendRemove"]> }
  | { messageId: string; kind: "project_delete"; data: NonNullable<ChatMessage["pendingProjectDelete"]> };

/** The one open confirmation (if any) — rendered as a fixed bar, not inside the scrollable list. */
function findActivePending(messages: ChatMessage[]): ActivePending | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.pendingTask && !message.pendingTask.confirmed) {
      return { messageId: message.id, kind: "task", data: message.pendingTask };
    }
    if (message.pendingProject && !message.pendingProject.confirmed) {
      return { messageId: message.id, kind: "project", data: message.pendingProject };
    }
    if (message.pendingMessage && !message.pendingMessage.confirmed) {
      return { messageId: message.id, kind: "message", data: message.pendingMessage };
    }
    if (message.pendingFriendAdd && !message.pendingFriendAdd.confirmed) {
      return { messageId: message.id, kind: "friend_add", data: message.pendingFriendAdd };
    }
    if (message.pendingFriendRemove && !message.pendingFriendRemove.confirmed) {
      return { messageId: message.id, kind: "friend_remove", data: message.pendingFriendRemove };
    }
    if (message.pendingProjectDelete && !message.pendingProjectDelete.confirmed) {
      return { messageId: message.id, kind: "project_delete", data: message.pendingProjectDelete };
    }
  }
  return null;
}

export function AssistantScreen({
  messages,
  isThinking,
  loadError,
  onBack,
  onSend,
  onConfirmTask,
  onDismissTask,
  onConfirmProject,
  onDismissProject,
  onConfirmMessage,
  onDismissMessage,
  onConfirmFriendAdd,
  onDismissFriendAdd,
  onConfirmFriendRemove,
  onDismissFriendRemove,
  onConfirmProjectDelete,
  onDismissProjectDelete,
}: AssistantScreenProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  const [draft, setDraft] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const listRef = useRef<FlatList>(null);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const activePending = findActivePending(messages);

  function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || isThinking) return;
    setDraft("");
    onSend(trimmed);
  }

  async function handleConfirm(pending: ActivePending) {
    setIsConfirming(true);
    try {
      if (pending.kind === "task") {
        await onConfirmTask(pending.messageId);
      } else if (pending.kind === "project") {
        await onConfirmProject(pending.messageId);
      } else if (pending.kind === "message") {
        await onConfirmMessage(pending.messageId);
      } else if (pending.kind === "friend_add") {
        await onConfirmFriendAdd(pending.messageId);
      } else if (pending.kind === "friend_remove") {
        await onConfirmFriendRemove(pending.messageId);
      } else {
        await onConfirmProjectDelete(pending.messageId);
      }
    } finally {
      setIsConfirming(false);
    }
  }

  function handleDismiss(pending: ActivePending) {
    if (pending.kind === "task") {
      onDismissTask(pending.messageId);
    } else if (pending.kind === "project") {
      onDismissProject(pending.messageId);
    } else if (pending.kind === "message") {
      onDismissMessage(pending.messageId);
    } else if (pending.kind === "friend_add") {
      onDismissFriendAdd(pending.messageId);
    } else if (pending.kind === "friend_remove") {
      onDismissFriendRemove(pending.messageId);
    } else {
      onDismissProjectDelete(pending.messageId);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            style={styles.backButton}
          >
            <Text style={styles.backButtonIcon}>‹</Text>
          </Pressable>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle}>KI-Assistent</Text>
            <Text style={styles.headerSubtitle}>Lokal über Ollama · Prototyp</Text>
          </View>
        </View>
        <View style={styles.headerDivider} />

        {loadError && (
          <Text style={styles.errorBanner} accessibilityRole="alert">
            {loadError}
          </Text>
        )}

        <FlatList
          ref={listRef}
          style={styles.messageList}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          onContentSizeChange={() => {
            // Fires purely from measured content height — never from a
            // manual scroll — so it's safe to always follow it to the true
            // end. It can fire several times in a row for one new message as
            // its real height (e.g. a tall proposal card) settles across
            // render passes, which is exactly why we don't gate this to
            // "once per message": doing so previously consumed the one
            // scroll attempt on an early, still-incomplete measurement.
            listRef.current?.scrollToOffset({ offset: 1_000_000, animated: true });
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Schreib z. B. „Leg einen Task Design Review für morgen mit hoher Priorität in Marketing
              Kampagne an“.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.role === "user" && styles.bubbleRowUser]}>
              <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
                <Text style={[styles.bubbleText, item.role === "user" && styles.bubbleTextUser]}>
                  {item.text}
                </Text>
              </View>

              {/* Deliberately just one plain Text, same shape whether pending or
                  confirmed — only the string content differs. The full card
                  with its buttons and conditional sections used to live here,
                  but as a list item its shape changed after confirming, which
                  was the actual cause of the "stuck" scrolling: it lives as a
                  fixed bar above the input instead now (see activePending). */}
              {item.pendingTask && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText} numberOfLines={2}>
                    {item.pendingTask.confirmed ? "✓ " : "📋 "}
                    {item.pendingTask.title} · {item.pendingTask.projectName}
                  </Text>
                </View>
              )}

              {item.pendingProject && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText} numberOfLines={2}>
                    {item.pendingProject.confirmed ? "✓ " : "📋 "}
                    {item.pendingProject.existingProjectId ? "Tasks für " : "Neues Projekt: "}
                    {item.pendingProject.name}
                    {item.pendingProject.taskTitles.length > 0
                      ? ` · ${item.pendingProject.taskTitles.length} Task${item.pendingProject.taskTitles.length === 1 ? "" : "s"}`
                      : ""}
                  </Text>
                </View>
              )}

              {item.pendingMessage && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText} numberOfLines={2}>
                    {item.pendingMessage.confirmed ? "✓ " : "📋 "}
                    Nachricht an {item.pendingMessage.friendName}
                  </Text>
                </View>
              )}

              {item.pendingFriendAdd && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText} numberOfLines={2}>
                    {item.pendingFriendAdd.confirmed ? "✓ " : "📋 "}
                    Freundschaftsanfrage an {item.pendingFriendAdd.targetName}
                  </Text>
                </View>
              )}

              {item.pendingFriendRemove && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText} numberOfLines={2}>
                    {item.pendingFriendRemove.confirmed ? "✓ " : "📋 "}
                    {item.pendingFriendRemove.friendName} entfernen
                  </Text>
                </View>
              )}

              {item.pendingProjectDelete && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText} numberOfLines={2}>
                    {item.pendingProjectDelete.confirmed ? "✓ " : "📋 "}
                    Projekt {item.pendingProjectDelete.projectName} löschen
                  </Text>
                </View>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        />

        {isThinking && (
          <View style={styles.thinkingRow}>
            <ActivityIndicator color={colors.brandOrange} size="small" />
            <Text style={styles.thinkingText}>Denkt nach…</Text>
          </View>
        )}

        {activePending && (
          <View style={styles.pendingBar}>
            <Text style={styles.taskCardLabel}>
              {activePending.kind === "task"
                ? "VORSCHLAG"
                : activePending.kind === "project"
                  ? activePending.data.existingProjectId
                    ? "TASKS HINZUFÜGEN"
                    : "PROJEKT-VORSCHLAG"
                  : activePending.kind === "message"
                    ? "NACHRICHT"
                    : activePending.kind === "friend_add"
                      ? "FREUND HINZUFÜGEN"
                      : activePending.kind === "friend_remove"
                        ? "FREUND ENTFERNEN"
                        : "PROJEKT LÖSCHEN"}
            </Text>
            <Text style={styles.taskCardTitle} numberOfLines={2}>
              {activePending.kind === "task"
                ? activePending.data.title
                : activePending.kind === "project"
                  ? activePending.data.name
                  : activePending.kind === "message"
                    ? activePending.data.friendName
                    : activePending.kind === "friend_add"
                      ? activePending.data.targetName
                      : activePending.kind === "friend_remove"
                        ? activePending.data.friendName
                        : activePending.data.projectName}
            </Text>

            {activePending.kind === "task" && (
              <View style={styles.taskCardMetaRow}>
                <Text style={styles.taskCardMeta} numberOfLines={1}>
                  {activePending.data.projectName} · {formatDueDate(activePending.data.dueDate)}
                </Text>
                <PriorityBadge priority={activePending.data.priority} />
              </View>
            )}

            {activePending.kind === "project" && (
              <>
                {!activePending.data.existingProjectId && (
                  <Text style={styles.taskCardMeta}>
                    Bis {formatDueDate(activePending.data.dueDate)}
                    {activePending.data.participantNames.length > 0
                      ? ` · Mit ${activePending.data.participantNames.join(", ")}`
                      : ""}
                  </Text>
                )}
                {activePending.data.taskTitles.length > 0 && (
                  <View style={styles.projectTaskList}>
                    {activePending.data.taskTitles.map((title) => (
                      <View key={title} style={styles.projectTaskRow}>
                        <Text style={styles.projectTaskTitle} numberOfLines={1}>
                          {title}
                        </Text>
                        <PriorityBadge priority={activePending.data.priorities[title] ?? "medium"} />
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {activePending.kind === "message" && (
              <Text style={styles.taskCardMeta}>„{activePending.data.body}"</Text>
            )}

            {activePending.kind === "project_delete" && (
              <Text style={styles.taskCardMeta}>
                {activePending.data.taskCount} Task{activePending.data.taskCount === 1 ? "" : "s"}, Phasen und
                Mitglieder werden mitgelöscht. Das kann nicht rückgängig gemacht werden.
              </Text>
            )}

            <View style={styles.taskCardActions}>
              <Pressable
                onPress={() => handleDismiss(activePending)}
                style={styles.taskCardDismiss}
                accessibilityRole="button"
                accessibilityLabel="Vorschlag verwerfen"
              >
                <Text style={styles.taskCardDismissText}>Verwerfen</Text>
              </Pressable>
              <Pressable
                onPress={() => handleConfirm(activePending)}
                disabled={isConfirming}
                style={styles.taskCardConfirm}
                accessibilityRole="button"
                accessibilityLabel={activePending.kind === "task" ? "Task erstellen" : "Bestätigen"}
              >
                {isConfirming ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.taskCardConfirmText}>
                    {activePending.kind === "task"
                      ? "TASK ERSTELLEN"
                      : activePending.kind === "project"
                        ? activePending.data.existingProjectId
                          ? "TASKS HINZUFÜGEN"
                          : "PROJEKT ERSTELLEN"
                        : activePending.kind === "message"
                          ? "NACHRICHT SENDEN"
                          : activePending.kind === "friend_add"
                            ? "ANFRAGE SENDEN"
                            : activePending.kind === "friend_remove"
                              ? "ENTFERNEN"
                              : "ENDGÜLTIG LÖSCHEN"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleSend}
            placeholder="z. B. Leg einen Task an…"
            placeholderTextColor={colors.textMutedLight}
            returnKeyType="send"
            accessibilityLabel="Nachricht an den Assistenten"
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || isThinking}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && styles.sendButtonPressed,
              (!draft.trim() || isThinking) && styles.sendButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Senden"
          >
            <Text style={styles.sendButtonText}>→</Text>
          </Pressable>
        </View>
    </SafeAreaView>
  );
}

const CARD_RADIUS = 15;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.warmCream,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 19,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -Spacing.two,
  },
  backButtonIcon: {
    fontSize: 26,
    color: colors.ink,
  },
  headerTextCol: {
    gap: 1,
  },
  headerTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 18,
    color: colors.ink,
  },
  headerSubtitle: {
    fontFamily: "DMMono_400Regular",
    fontSize: 10,
    letterSpacing: 0.3,
    color: colors.textMutedLight,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginTop: Spacing.two,
  },
  errorBanner: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.priorityHighText,
    paddingHorizontal: 19,
    paddingTop: Spacing.two,
  },
  messageList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: Spacing.six,
  },
  bubbleRow: {
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  bubbleRowUser: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: CARD_RADIUS,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
  },
  bubbleUser: {
    backgroundColor: colors.brandOrange,
  },
  bubbleText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: "#FFFFFF",
  },
  summaryRow: {
    maxWidth: "85%",
    backgroundColor: "rgba(232, 90, 26, 0.08)",
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  summaryText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: colors.ink,
  },
  pendingBar: {
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: colors.brandOrange,
    padding: Spacing.three,
    gap: Spacing.two,
    marginHorizontal: 18,
    marginBottom: Spacing.two,
  },
  taskCardLabel: {
    fontFamily: "DMMono_500Medium",
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.brandOrange,
  },
  taskCardTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
    color: colors.ink,
  },
  taskCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  taskCardMeta: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.textMutedLight,
  },
  projectTaskList: {
    gap: Spacing.one,
  },
  projectTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    backgroundColor: colors.warmCream,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  projectTaskTitle: {
    flex: 1,
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: colors.ink,
  },
  taskCardActions: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  taskCardDismiss: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warmCream,
  },
  taskCardDismissText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.textMuted,
  },
  taskCardConfirm: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandOrange,
  },
  taskCardConfirmText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 12,
    letterSpacing: 0.3,
    color: "#FFFFFF",
  },
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: 19,
    paddingBottom: Spacing.two,
  },
  thinkingText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: 19,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.ink,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonPressed: {
    opacity: 0.85,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});
