import { useEffect, useRef } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AvatarStack } from "@/components/avatar-stack";
import { PhaseProgressBar } from "@/components/phase-progress-bar";
import { PriorityBadge } from "@/components/priority-badge";
import { Icon } from "@/components/icons";
import { colors } from "@/theme/colors";
import { Spacing } from "@/constants/theme";
import type { TaskWithRelations } from "@/types/tasks";

export function formatDueDate(dueDate: string | null): { text: string; isUrgent: boolean } | null {
  if (!dueDate) return null;

  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  const dateLabel = due.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let relative: string;
  if (diffDays === 0) relative = "heute fällig";
  else if (diffDays === 1) relative = "morgen fällig";
  else if (diffDays > 1) relative = `in ${diffDays} Tagen`;
  else relative = `${Math.abs(diffDays)} Tage überfällig`;

  return { text: `${dateLabel} – ${relative}`, isUrgent: diffDays <= 1 };
}

export type TaskCardProps = {
  task: TaskWithRelations;
  isExpanded: boolean;
  onToggleExpand: (taskId: string) => void;
  onToggleDone: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
};

// Material-style standard curve: quick start, soft landing.
const EXPAND_DURATION_MS = 300;
const EXPAND_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export function TaskCard({ task, isExpanded, onToggleExpand, onToggleDone, onDelete, onEdit }: TaskCardProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const due = formatDueDate(task.due_date);

  const progress = useSharedValue(isExpanded ? 1 : 0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(isExpanded ? 1 : 0, {
      duration: EXPAND_DURATION_MS,
      easing: EXPAND_EASING,
    });
  }, [isExpanded, progress]);

  const expandStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
    opacity: progress.value,
    // Cancel one of the card's flex gaps while collapsed so the layout matches the old one.
    marginTop: -Spacing.two * (1 - progress.value),
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(1 - progress.value) * 180}deg` }],
  }));

  function handleDeletePress() {
    swipeableRef.current?.close();
    Alert.alert("Task wirklich löschen?", task.title, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: () => onDelete(task.id),
      },
    ]);
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={() => (
        <Pressable
          onPress={handleDeletePress}
          style={styles.deleteAction}
          accessibilityRole="button"
          accessibilityLabel="Task löschen"
          accessibilityHint={`Löscht den Task „${task.title}“ nach Bestätigung`}
        >
          <TrashGlyph />
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => onEdit?.(task.id)}
        style={[styles.card, task.is_done && styles.cardDone]}
        accessibilityRole="button"
        accessibilityLabel={`Task bearbeiten: ${task.title}`}
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={() => onToggleDone(task.id)}
            style={[styles.checkbox, task.is_done && styles.checkboxChecked]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.is_done }}
            accessibilityLabel={task.is_done ? "Als offen markieren" : "Als erledigt markieren"}
          >
            {task.is_done && <Text style={styles.checkboxMark}>✓</Text>}
          </Pressable>

          <Text
            style={[styles.title, task.is_done && styles.titleDone]}
            numberOfLines={2}
          >
            {task.title}
          </Text>

          <PriorityBadge priority={task.priority} />
        </View>

        {due && (
          <Text style={[styles.dueText, due.isUrgent && !task.is_done && styles.dueTextUrgent]}>
            {due.text}
          </Text>
        )}

        <PhaseProgressBar
          phases={task.projectPhases}
          currentPhaseId={task.phase_id}
          isDone={task.is_done}
        />

        <Animated.View style={[styles.expandClip, expandStyle]} pointerEvents={isExpanded ? "auto" : "none"}>
          <View
            style={styles.expandedContent}
            onLayout={(event) => {
              contentHeight.value = event.nativeEvent.layout.height;
            }}
          >
            <View style={styles.expandedFooter}>
              <AvatarStack profiles={task.assignees} />

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <CommentGlyph />
                  <Text style={styles.metaText}>{task.commentCount}</Text>
                </View>
                {/* TODO: Bearbeitungs-Historie ist noch kein Feature — Zahl ist
                    Platzhalter, bis es eine echte Datenquelle dafür gibt. */}
                <View style={styles.metaItem}>
                  <PencilGlyph />
                  <Text style={styles.metaText}>0</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        <Pressable
          onPress={() => onToggleExpand(task.id)}
          style={styles.chevronButton}
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? "Task einklappen" : "Task ausklappen"}
        >
          <Animated.View style={chevronStyle}>
            <Icon name="chevronUp" size={22} color={colors.textMutedLight} />
          </Animated.View>
        </Pressable>
      </Pressable>
    </Swipeable>
  );
}

function TrashGlyph() {
  return (
    <View style={glyphStyles.trash}>
      <View style={glyphStyles.trashLid} />
      <View style={glyphStyles.trashBody} />
    </View>
  );
}

function CommentGlyph() {
  return <View style={glyphStyles.comment} />;
}

function PencilGlyph() {
  return <View style={glyphStyles.pencil} />;
}

const CARD_RADIUS = 15;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    padding: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardDone: {
    opacity: 0.5,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(44, 44, 44, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.brandOrange,
    borderColor: colors.brandOrange,
  },
  checkboxMark: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    flex: 1,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
  },
  titleDone: {
    textDecorationLine: "line-through",
  },
  dueText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 30,
  },
  dueTextUrgent: {
    color: colors.priorityHighText,
  },
  chevronButton: {
    alignSelf: "center",
    // Shifted down 10px (and compensated below) so the arrow sits midway between
    // the progress bar and the card's bottom edge without changing the card height.
    marginTop: Spacing.half * 3,
    marginBottom: -10,
    paddingHorizontal: Spacing.four,
    paddingVertical: 2,
  },
  expandClip: {
    overflow: "hidden",
  },
  expandedContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  expandedFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.two,
  },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: colors.textMuted,
  },
  deleteAction: {
    backgroundColor: colors.priorityHighText,
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    borderRadius: CARD_RADIUS,
    marginLeft: Spacing.two,
  },
});

const glyphStyles = StyleSheet.create({
  trash: {
    width: 20,
    height: 20,
    alignItems: "center",
  },
  trashLid: {
    width: 14,
    height: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 1,
  },
  trashBody: {
    width: 12,
    height: 13,
    marginTop: 1,
    borderWidth: 1.6,
    borderColor: "#FFFFFF",
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  comment: {
    width: 14,
    height: 11,
    borderWidth: 1.4,
    borderColor: colors.textMuted,
    borderRadius: 3,
    borderBottomRightRadius: 0,
  },
  pencil: {
    width: 12,
    height: 2.2,
    backgroundColor: colors.textMuted,
    borderRadius: 1,
    transform: [{ rotate: "-45deg" }],
  },
});
