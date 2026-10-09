import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { PriorityBadge } from "@/components/priority-badge";
import { Spacing } from "@/constants/theme";
import { avatarFallbackColor, colors } from "@/theme/colors";
import type { Priority, Profile } from "@/types/tasks";

SplashScreen.preventAutoHideAsync().catch(() => {});

export type CalendarEntry =
  | {
      kind: "task";
      id: string;
      date: string;
      title: string;
      projectId: string | null;
      projectName: string | null;
      priority: Priority;
      isDone: boolean;
    }
  | {
      kind: "project";
      id: string;
      date: string;
      title: string;
    };

export type CalendarScreenProps = {
  currentUser?: Profile;
  entries: CalendarEntry[];
  loadError?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onPressAvatar?: () => void;
  onOpenProject?: (projectId: string) => void;
};

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayKey(): string {
  return dateKey(new Date());
}

type MonthCell = { key: string; day: number; inCurrentMonth: boolean };

/** Builds a 6x7 Monday-first grid of day cells covering the given month, with leading/trailing days from neighboring months to fill the grid. */
function buildMonthGrid(monthDate: Date): MonthCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // getDay(): 0=Sun..6=Sat — shift so Monday is 0.
  const leadingDays = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - leadingDays);

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    return {
      key: dateKey(cellDate),
      day: cellDate.getDate(),
      inCurrentMonth: cellDate.getMonth() === month,
    };
  });
}

function formatSelectedDate(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function CalendarScreen({
  currentUser,
  entries,
  loadError,
  refreshing,
  onRefresh,
  onPressAvatar,
  onOpenProject,
}: CalendarScreenProps) {
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

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayKey());

  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return map;
  }, [entries]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const grid = buildMonthGrid(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const selectedEntries = entriesByDate.get(selectedDate) ?? [];
  const today = todayKey();

  function changeMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kalender</Text>
        <View style={styles.headerSpacer} />
        <Pressable
          onPress={onPressAvatar}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Zum Profil"
        >
          <Avatar name={currentUser?.full_name ?? null} color={currentUser?.avatar_color ?? avatarFallbackColor} shape="square" size={40} />
        </Pressable>
      </View>
      <View style={styles.headerDivider} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.brandOrange} />
        }
      >
        {loadError && (
          <Text style={styles.errorText} accessibilityRole="alert">
            {loadError}
          </Text>
        )}

        <View style={styles.monthRow}>
          <Pressable
            onPress={() => changeMonth(-1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Vorheriger Monat"
            style={styles.monthNavButton}
          >
            <Text style={styles.monthNavIcon}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable
            onPress={() => changeMonth(1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Nächster Monat"
            style={styles.monthNavButton}
          >
            <Text style={styles.monthNavIcon}>›</Text>
          </Pressable>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {grid.map((cell) => {
              const isSelected = cell.key === selectedDate;
              const isToday = cell.key === today;
              const hasEntries = entriesByDate.has(cell.key);
              return (
                <Pressable
                  key={cell.key}
                  onPress={() => setSelectedDate(cell.key)}
                  style={styles.cell}
                  accessibilityRole="button"
                  accessibilityLabel={`${cell.day}.${visibleMonth.getMonth() + 1}.`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View
                    style={[
                      styles.cellCircle,
                      isSelected && styles.cellCircleSelected,
                      isToday && !isSelected && styles.cellCircleToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        !cell.inCurrentMonth && styles.cellTextMuted,
                        isSelected && styles.cellTextSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>
                  <View style={[styles.cellDot, hasEntries && styles.cellDotVisible]} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.agendaLabel}>{formatSelectedDate(selectedDate).toUpperCase()}</Text>

        {selectedEntries.length === 0 ? (
          <Text style={styles.emptyText}>Keine Termine an diesem Tag.</Text>
        ) : (
          <View style={styles.card}>
            {selectedEntries.map((entry, index) => (
              <View key={`${entry.kind}-${entry.id}`}>
                {index > 0 && <View style={styles.rowDivider} />}
                <Pressable
                  onPress={() => {
                    const projectId = entry.kind === "task" ? entry.projectId : entry.id;
                    if (projectId) onOpenProject?.(projectId);
                  }}
                  style={styles.entryRow}
                  accessibilityRole="button"
                  accessibilityLabel={entry.title}
                >
                  <View style={styles.entryTextCol}>
                    <Text style={styles.entryTitle} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <Text style={styles.entrySubtitle} numberOfLines={1}>
                      {entry.kind === "task" ? (entry.projectName ?? "Ohne Projekt") : "Projekt-Abschluss"}
                    </Text>
                  </View>
                  {entry.kind === "task" && <PriorityBadge priority={entry.priority} />}
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_RADIUS = 15;

const styles = StyleSheet.create({
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
  headerTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 22,
    color: colors.ink,
  },
  headerSpacer: {
    flex: 1,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginTop: Spacing.two,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: Spacing.four,
    paddingBottom: 110,
    gap: Spacing.three,
  },
  errorText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.priorityHighText,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthNavButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavIcon: {
    fontSize: 22,
    color: colors.ink,
  },
  monthLabel: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    color: colors.ink,
    textTransform: "capitalize",
  },
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    padding: Spacing.three,
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: "DMMono_500Medium",
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.textMutedLight,
    marginBottom: Spacing.two,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    paddingVertical: 4,
    gap: 3,
  },
  cellCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  cellCircleSelected: {
    backgroundColor: colors.brandOrange,
  },
  cellCircleToday: {
    borderWidth: 1,
    borderColor: colors.brandOrange,
  },
  cellText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: colors.ink,
  },
  cellTextMuted: {
    color: colors.textMutedLight,
  },
  cellTextSelected: {
    color: "#FFFFFF",
  },
  cellDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "transparent",
  },
  cellDotVisible: {
    backgroundColor: colors.brandOrange,
  },
  agendaLabel: {
    fontFamily: "DMMono_500Medium",
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    padding: Spacing.three,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: Spacing.two,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  entryTextCol: {
    flex: 1,
    gap: 2,
  },
  entryTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
    color: colors.ink,
  },
  entrySubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.textMutedLight,
  },
  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
});
