import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { ProjectCard } from "@/components/project-card";
import { TaskCard } from "@/components/task-card";
import { Spacing } from "@/constants/theme";
import type { ProjectSummary } from "@/lib/tasks";
import { colors } from "@/theme/colors";
import type { Profile, TaskWithRelations } from "@/types/tasks";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// The root layout already hides the native splash screen on first paint (see
// `AnimatedSplashOverlay`). This call is a defensive no-op guard, matching
// the pattern used on the other screens.
SplashScreen.preventAutoHideAsync().catch(() => {});

export type TasksOverviewScreenProps = {
  username?: string;
  currentUser?: Profile;
  /** Defaults to today, formatted in German ("Dienstag, 3. Juni"). */
  dateLabel?: string;
  openTasksCount: number;
  dueTodayCount: number;
  dueTodayTasks: TaskWithRelations[];
  projects: ProjectSummary[];
  /** Set when the dashboard failed to load from Supabase. */
  loadError?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onCreateProject?: () => void;
  onOpenProject?: (projectId: string) => void;
  onPressAvatar?: () => void;
  onToggleDone?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
};

function defaultDateLabel(): string {
  return new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

type DashboardSection =
  | { kind: "due-today"; title: string; data: TaskWithRelations[] }
  | { kind: "projects"; title: string; data: ProjectSummary[] };

export function TasksOverviewScreen({
  username,
  currentUser,
  dateLabel,
  openTasksCount,
  dueTodayCount,
  dueTodayTasks,
  projects,
  loadError,
  refreshing,
  onRefresh,
  onCreateProject,
  onOpenProject,
  onPressAvatar,
  onToggleDone,
  onDeleteTask,
  onEditTask,
}: TasksOverviewScreenProps) {
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
  const [localDueToday, setLocalDueToday] = useState<TaskWithRelations[]>(dueTodayTasks);

  useEffect(() => {
    setLocalDueToday(dueTodayTasks);
  }, [dueTodayTasks]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  function handleToggleExpand(taskId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLocalDueToday((current) => current.filter((task) => task.id !== taskId));
    onDeleteTask?.(taskId);
  }

  const sections: DashboardSection[] = [
    { kind: "due-today", title: "HEUTE FÄLLIG", data: localDueToday },
    { kind: "projects", title: "PROJEKTE", data: projects },
  ].filter((section) => section.data.length > 0) as DashboardSection[];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <SectionList<TaskWithRelations | ProjectSummary, DashboardSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.brandOrange} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={styles.dateLabel}>{dateLabel ?? defaultDateLabel()}</Text>
                <Text style={styles.greeting}>
                  Guten Morgen, {username ?? "Nutzer"}.
                </Text>
              </View>
              <Pressable
                onPress={onPressAvatar}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Zum Profil"
              >
                <Avatar
                  name={currentUser?.full_name ?? username ?? null}
                  color="#000000"
                  shape="square"
                  size={40}
                />
              </Pressable>
            </View>
            <View style={styles.headerDivider} />

            {loadError && (
              <Text style={styles.loadErrorText} accessibilityRole="alert">
                {loadError}
              </Text>
            )}

            <Text style={styles.sectionLabel}>ÜBERBLICK</Text>
            <View style={styles.overviewRow}>
              <OverviewCard value={projects.length} label="PROJEKTE" valueColor={colors.brandOrange} />
              <OverviewCard value={openTasksCount} label="OFFEN" valueColor={colors.ink} />
              <OverviewCard value={dueTodayCount} label="HEUTE FÄLLIG" valueColor={colors.ink} />
            </View>

            {sections.length === 0 && (
              <Text style={styles.emptyText}>Noch keine Projekte — leg dein erstes an!</Text>
            )}
          </>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionLabel}>{section.title}</Text>
        )}
        renderItem={({ item, section }) =>
          section.kind === "due-today" ? (
            <TaskCard
              task={item as TaskWithRelations}
              isExpanded={expandedIds.has(item.id)}
              onToggleExpand={handleToggleExpand}
              onToggleDone={(taskId) => onToggleDone?.(taskId)}
              onDelete={handleDelete}
              onEdit={onEditTask}
            />
          ) : (
            <ProjectCard project={item as ProjectSummary} onPress={onOpenProject} />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        SectionSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
      />

      <Pressable
        onPress={onCreateProject}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Projekt erstellen"
      >
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function OverviewCard({
  value,
  label,
  valueColor,
}: {
  value: number;
  label: string;
  valueColor: string;
}) {
  return (
    <View style={styles.overviewCard}>
      <Text style={[styles.overviewValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.overviewLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.warmCream,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: Spacing.three,
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  dateLabel: {
    fontFamily: "DMMono_500Medium",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textMutedLight,
  },
  greeting: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
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
    marginBottom: Spacing.two,
  },
  overviewRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: Spacing.four,
  },
  overviewCard: {
    flex: 1,
    height: 70,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  overviewValue: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 22,
  },
  overviewLabel: {
    fontFamily: "DMMono_400Regular",
    fontSize: 9,
    letterSpacing: 0.4,
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
    bottom: 97,
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
