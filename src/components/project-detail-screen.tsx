import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState, useMemo } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AvatarStack } from "@/components/avatar-stack";
import { KanbanBoard } from "@/components/kanban-board";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { TaskCard } from "@/components/task-card";
import { Spacing } from "@/constants/theme";
import type { Palette } from "@/theme/colors";
import { useColors } from "@/theme/theme-context";
import type { Phase, Profile, TaskWithRelations } from "@/types/tasks";

SplashScreen.preventAutoHideAsync().catch(() => {});

function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  return new Date(`${dueDate}T00:00:00`).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export type ProjectDetailScreenProps = {
  project: { id: string; name: string; due_date: string | null };
  members: Profile[];
  tasks: TaskWithRelations[];
  /** The project's phases — the columns of the board view. */
  phases?: Phase[];
  /** Set when the project failed to load from Supabase. */
  loadError?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onBack?: () => void;
  onCreateTask?: () => void;
  onEditTask?: (taskId: string) => void;
  onOpenThread?: (taskId: string) => void;
  onToggleDone?: (taskId: string) => void;
  onMoveTask?: (taskId: string, phaseId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onDeleteProject?: (projectId: string) => Promise<void> | void;
};

export function ProjectDetailScreen({
  project,
  members,
  tasks,
  phases = [],
  loadError,
  refreshing,
  onRefresh,
  onBack,
  onCreateTask,
  onEditTask,
  onOpenThread,
  onToggleDone,
  onMoveTask,
  onDeleteTask,
  onDeleteProject,
}: ProjectDetailScreenProps) {
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

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [localTasks, setLocalTasks] = useState<TaskWithRelations[]>(tasks);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");

  // 0 = list, 1 = board. Drives the toggle's sliding pill and the sideways slide of the two panes.
  const viewProgress = useSharedValue(0);
  const paneWidth = useSharedValue(0);
  useEffect(() => {
    viewProgress.value = withTiming(view === "board" ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [view, viewProgress]);
  const listPaneStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -viewProgress.value * paneWidth.value }],
  }));
  const boardPaneStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - viewProgress.value) * paneWidth.value }],
    // Hidden until the pane width is known, otherwise the board would flash over the list.
    opacity: paneWidth.value > 0 ? 1 : 0,
  }));

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  function handleDeleteProject() {
    Alert.alert(
      "Projekt wirklich löschen?",
      `„${project.name}“ und alle ${localTasks.length} ${
        localTasks.length === 1 ? "Task darin werden" : "Tasks darin werden"
      } unwiderruflich gelöscht.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            setIsDeletingProject(true);
            try {
              await onDeleteProject?.(project.id);
            } catch (error) {
              console.error("Projekt konnte nicht gelöscht werden:", error);
              Alert.alert("Fehler", "Projekt konnte nicht gelöscht werden. Bitte versuche es erneut.");
            } finally {
              setIsDeletingProject(false);
            }
          },
        },
      ],
    );
  }

  function handleToggleExpand(taskId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function handleDelete(taskId: string) {
    setLocalTasks((current) => current.filter((task) => task.id !== taskId));
    onDeleteTask?.(taskId);
  }

  const formattedDueDate = formatDueDate(project.due_date);

  const header = (
    <>
            <View style={styles.topRow}>
              <Pressable
                onPress={onBack}
                style={styles.backRow}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Zurück zu Projekte"
              >
                <Text style={styles.backIcon}>‹</Text>
              </Pressable>

              <Pressable
                onPress={handleDeleteProject}
                disabled={isDeletingProject}
                hitSlop={8}
                style={styles.deleteProjectButton}
                accessibilityRole="button"
                accessibilityLabel="Projekt löschen"
              >
                <TrashGlyph />
              </Pressable>
            </View>

            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {project.name}
              </Text>
              <AvatarStack profiles={members} size={30} />
            </View>
            <Text style={styles.subtitle}>
              {members.length} {members.length === 1 ? "Mitglied" : "Mitglieder"}
              {formattedDueDate ? ` · Fällig ${formattedDueDate}` : ""}
            </Text>

            <View style={styles.headerDivider} />

            {loadError && (
              <Text style={styles.loadErrorText} accessibilityRole="alert">
                {loadError}
              </Text>
            )}


      <SegmentedToggle
        options={[
          { key: "list", label: "Liste", accessibilityLabel: "Listenansicht" },
          { key: "board", label: "Board", accessibilityLabel: "Board-Ansicht" },
        ]}
        value={view}
        progress={viewProgress}
        onChange={setView}
      />
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.boardHeader}>{header}</View>

      <View style={styles.panes} onLayout={(event) => (paneWidth.value = event.nativeEvent.layout.width)}>
        <Animated.View
          style={[StyleSheet.absoluteFill, listPaneStyle]}
          pointerEvents={view === "list" ? "auto" : "none"}
        >
          <FlatList
        data={localTasks}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.brandOrange} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.tasksSectionRow}>
              <Text style={styles.sectionLabel}>TASKS</Text>
              <Text style={styles.tasksSectionCount}>
                {localTasks.length} {localTasks.length === 1 ? "Task" : "Tasks"}
              </Text>
            </View>

            {localTasks.length === 0 && (
              <Text style={styles.emptyText}>Noch keine Tasks in diesem Projekt.</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            isExpanded={expandedIds.has(item.id)}
            onToggleExpand={handleToggleExpand}
            onToggleDone={(taskId) => onToggleDone?.(taskId)}
            onDelete={handleDelete}
            onEdit={onEditTask}
            onOpenThread={onOpenThread}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
      />
        </Animated.View>

        <Animated.View
          style={[StyleSheet.absoluteFill, boardPaneStyle]}
          pointerEvents={view === "board" ? "auto" : "none"}
        >
          <KanbanBoard
            phases={phases}
            tasks={localTasks}
            onMoveTask={(taskId, phaseId) => onMoveTask?.(taskId, phaseId)}
            onEditTask={onEditTask}
          />
        </Animated.View>
      </View>

      <Pressable
        onPress={onCreateTask}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Task erstellen"
      >
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function TrashGlyph() {
  const colors = useColors();
  const glyphStyles = useMemo(() => makeGlyphStyles(colors), [colors]);
  return (
    <View style={glyphStyles.trash}>
      <View style={glyphStyles.trashLid} />
      <View style={glyphStyles.trashBody} />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.warmCream,
    },
    boardHeader: {
      paddingHorizontal: 18,
      paddingTop: Spacing.two,
    },
    panes: {
      flex: 1,
      overflow: "hidden",
    },
    listContent: {
      paddingHorizontal: 18,
      paddingTop: Spacing.two,
      paddingBottom: 110,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    // Same back button as the other screens (profile, teams, messages …).
    backRow: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: -Spacing.two,
      marginBottom: Spacing.two,
    },
    deleteProjectButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.two,
    },
    backIcon: {
      fontSize: 26,
      color: colors.ink,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: Spacing.two,
    },
    title: {
      flex: 1,
      fontFamily: "DMSans_600SemiBold",
      fontSize: 24,
      lineHeight: 30,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: "DMSans_400Regular",
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 4,
    },
    headerDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginTop: Spacing.three,
      marginBottom: Spacing.four,
    },
    loadErrorText: {
      fontFamily: "DMSans_400Regular",
      fontSize: 13,
      color: colors.priorityHighText,
      marginBottom: Spacing.three,
    },
    sectionLabel: {
      fontFamily: "DMMono_500Medium",
      fontSize: 12,
      letterSpacing: 0.5,
      color: colors.textMuted,
    },
    tasksSectionRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: Spacing.two,
    },
    tasksSectionCount: {
      fontFamily: "DMMono_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
    emptyText: {
      fontFamily: "DMSans_400Regular",
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: Spacing.three,
    },
    fab: {
      position: "absolute",
      right: 19,
      bottom: Spacing.three,
      width: 50,
      height: 50,
      borderRadius: 15,
      backgroundColor: colors.brandOrange,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    fabPlus: {
      color: "#FFFFFF",
      fontSize: 26,
      lineHeight: 28,
      fontFamily: "DMSans_600SemiBold",
    },
  });

const makeGlyphStyles = (colors: Palette) =>
  StyleSheet.create({
    trash: {
      width: 20,
      height: 20,
      alignItems: "center",
    },
    trashLid: {
      width: 14,
      height: 2,
      backgroundColor: colors.priorityHighText,
      borderRadius: 1,
    },
    trashBody: {
      width: 12,
      height: 13,
      marginTop: 1,
      borderWidth: 1.6,
      borderColor: colors.priorityHighText,
      borderTopWidth: 0,
      borderBottomLeftRadius: 3,
      borderBottomRightRadius: 3,
    },
  });
