import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { Spacing } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errors";
import type { ThreadActivity, ThreadComment, ThreadEntry } from "@/lib/task-thread";
import { avatarFallbackColor } from "@/theme/colors";
import type { Palette } from "@/theme/colors";
import { useColors } from "@/theme/theme-context";

SplashScreen.preventAutoHideAsync().catch(() => {});

type ThreadTab = "all" | "comments" | "notifications";

const TABS: { key: ThreadTab; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "comments", label: "Kommentare" },
  { key: "notifications", label: "Meldungen" },
];

const EMPTY_TEXT: Record<ThreadTab, string> = {
  all: "Noch keine Einträge. Schreib den ersten Kommentar.",
  comments: "Noch keine Kommentare.",
  notifications: "Noch keine Benachrichtigungen.",
};

function formatEntryTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const time = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) return `Heute, ${time}`;
  return `${date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}, ${time}`;
}

function describeActivity(entry: ThreadActivity): string {
  const actor = entry.actor?.full_name ?? "Jemand";
  const person = entry.data.userName ?? "Jemand";
  switch (entry.type) {
    case "task_created":
      return `${actor} hat den Task erstellt`;
    case "assignee_added":
      return `${person} wurde zum Task hinzugefügt`;
    case "assignee_removed":
      return `${person} wurde vom Task entfernt`;
    case "phase_changed":
      return `${actor} hat den Task von ${entry.data.from ?? "–"} nach ${entry.data.to ?? "–"} verschoben`;
    case "marked_done":
      return `${actor} hat den Task als erledigt markiert`;
    case "marked_open":
      return `${actor} hat den Task wieder geöffnet`;
  }
}

export type TaskThreadScreenProps = {
  taskTitle: string;
  entries: ThreadEntry[];
  /** Set when the thread failed to load from Supabase. */
  loadError?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onBack?: () => void;
  onSendComment?: (content: string) => Promise<void> | void;
  onToggleLike?: (commentId: string, liked: boolean) => void;
};

export function TaskThreadScreen({
  taskTitle,
  entries,
  loadError,
  refreshing,
  onRefresh,
  onBack,
  onSendComment,
  onToggleLike,
}: TaskThreadScreenProps) {
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

  const [tab, setTab] = useState<ThreadTab>("all");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) =>
        tab === "all" ? true : tab === "comments" ? entry.kind === "comment" : entry.kind === "activity",
      ),
    [entries, tab],
  );

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const canSend = draft.trim().length > 0 && !isSending;
  const showComposer = tab !== "notifications";

  async function handleSend() {
    if (!canSend) return;
    setSendError(null);
    setIsSending(true);
    try {
      await onSendComment?.(draft.trim());
      setDraft("");
    } catch (error) {
      console.error("Kommentar konnte nicht gesendet werden:", error);
      setSendError(getErrorMessage(error, "Kommentar konnte nicht gesendet werden."));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {taskTitle}
            </Text>
            <Text style={styles.headerSubtitle}>Kommentare & Verlauf</Text>
          </View>
        </View>
        <View style={styles.headerDivider} />

        <View style={styles.toggleWrap}>
          <SegmentedToggle options={TABS} value={tab} onChange={setTab} />
        </View>

        {loadError && (
          <Text style={styles.errorText} accessibilityRole="alert">
            {loadError}
          </Text>
        )}

        {/* Inverted: the newest entry sits at the bottom, right above the composer. */}
        <FlatList
          data={visibleEntries}
          inverted
          keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.brandOrange} />
          }
          ListEmptyComponent={
            // Inverted lists flip their children too, so flip the empty text back.
            <Text style={[styles.emptyText, styles.emptyTextFlipped]}>{EMPTY_TEXT[tab]}</Text>
          }
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          renderItem={({ item }) =>
            item.kind === "comment" ? (
              <CommentRow entry={item} onToggleLike={onToggleLike} />
            ) : (
              <ActivityRow entry={item} />
            )
          }
        />

        {showComposer && (
          <View style={styles.composer}>
            {sendError && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {sendError}
              </Text>
            )}
            <View style={styles.composerRow}>
              <TextInput
                style={styles.composerInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="Kommentar schreiben…"
                placeholderTextColor={colors.textMutedLight}
                multiline
                accessibilityLabel="Kommentar"
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Kommentar senden"
                style={({ pressed }) => [
                  styles.sendButton,
                  pressed && styles.sendButtonPressed,
                  !canSend && styles.sendButtonDisabled,
                ]}
              >
                {isSending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Icon name="send" size={24} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CommentRow({
  entry,
  onToggleLike,
}: {
  entry: ThreadComment;
  onToggleLike?: (commentId: string, liked: boolean) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.commentCard}>
      <View style={styles.commentTop}>
        <Avatar
          name={entry.author?.full_name ?? null}
          color={entry.author?.avatar_color ?? avatarFallbackColor}
          size={32}
        />
        <View style={styles.commentHeadText}>
          <Text style={styles.authorName} numberOfLines={1}>
            {entry.author?.full_name ?? "Unbekannt"}
          </Text>
          <Text style={styles.timeText}>{formatEntryTime(entry.createdAt)}</Text>
        </View>
        <Pressable
          onPress={() => onToggleLike?.(entry.id, !entry.likedByMe)}
          hitSlop={8}
          style={styles.likeButton}
          accessibilityRole="button"
          accessibilityState={{ selected: entry.likedByMe }}
          accessibilityLabel={entry.likedByMe ? "Gefällt mir zurücknehmen" : "Gefällt mir"}
        >
          <Text style={[styles.likeIcon, entry.likedByMe && styles.likeIconActive]}>
            {entry.likedByMe ? "♥" : "♡"}
          </Text>
          {entry.likeCount > 0 && (
            <Text style={[styles.likeCount, entry.likedByMe && styles.likeCountActive]}>{entry.likeCount}</Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.commentBody}>{entry.content}</Text>
    </View>
  );
}

function ActivityRow({ entry }: { entry: ThreadActivity }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.activityRow}>
      <Avatar
        name={entry.actor?.full_name ?? null}
        color={entry.actor?.avatar_color ?? avatarFallbackColor}
        size={22}
      />
      <View style={styles.activityText}>
        <Text style={styles.activityMessage}>{describeActivity(entry)}</Text>
        <Text style={styles.timeText}>{formatEntryTime(entry.createdAt)}</Text>
      </View>
    </View>
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
    headerText: {
      flex: 1,
    },
    headerTitle: {
      fontFamily: "DMSans_600SemiBold",
      fontSize: 18,
      color: colors.ink,
    },
    headerSubtitle: {
      fontFamily: "DMSans_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
    headerDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginTop: Spacing.two,
    },
    toggleWrap: {
      paddingHorizontal: 19,
      paddingTop: Spacing.three,
    },
    listContent: {
      paddingHorizontal: 19,
      paddingVertical: Spacing.two,
    },
    errorText: {
      fontFamily: "DMSans_400Regular",
      fontSize: 13,
      color: colors.priorityHighText,
      textAlign: "center",
      paddingHorizontal: 19,
      paddingBottom: Spacing.two,
    },
    emptyText: {
      fontFamily: "DMSans_400Regular",
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      paddingVertical: Spacing.five,
    },
    emptyTextFlipped: {
      transform: [{ scaleY: -1 }],
    },
    commentCard: {
      backgroundColor: colors.surface,
      borderRadius: CARD_RADIUS,
      padding: Spacing.three,
      gap: Spacing.two,
    },
    commentTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
    },
    commentHeadText: {
      flex: 1,
    },
    authorName: {
      fontFamily: "DMSans_600SemiBold",
      fontSize: 14,
      color: colors.ink,
    },
    timeText: {
      fontFamily: "DMSans_400Regular",
      fontSize: 11,
      color: colors.textMutedLight,
    },
    commentBody: {
      fontFamily: "DMSans_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink,
    },
    likeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    likeIcon: {
      fontSize: 20,
      color: colors.textMutedLight,
    },
    likeIconActive: {
      color: colors.brandOrange,
    },
    likeCount: {
      fontFamily: "DMSans_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    likeCountActive: {
      color: colors.brandOrange,
    },
    activityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
      paddingHorizontal: Spacing.one,
    },
    activityText: {
      flex: 1,
    },
    activityMessage: {
      fontFamily: "DMSans_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    composer: {
      paddingHorizontal: 19,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.two,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.warmCream,
    },
    composerRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: Spacing.two,
    },
    composerInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      backgroundColor: colors.surface,
      borderRadius: CARD_RADIUS,
      paddingHorizontal: Spacing.three,
      paddingTop: 12,
      paddingBottom: 12,
      fontFamily: "DMSans_400Regular",
      fontSize: 15,
      color: colors.ink,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: CARD_RADIUS,
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
  });
