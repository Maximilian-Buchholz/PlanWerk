import DateTimePicker from "@react-native-community/datetimepicker";
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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { PhaseBadge } from "@/components/phase-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { Spacing } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errors";
import type { Team } from "@/lib/teams";
import { colors } from "@/theme/colors";
import type { Phase, Priority, Profile } from "@/types/tasks";

SplashScreen.preventAutoHideAsync().catch(() => {});

const PRIORITY_CYCLE: Priority[] = ["low", "medium", "high"];

export type CreateTaskScreenProps = {
  project: { id: string; name: string; dueDate?: string | null };
  projectMembers: Profile[];
  /** Accepted friends of the current user — assignable even if not yet a project member. */
  friends: Profile[];
  /** The current user's friend groups, for assigning several people at once. */
  teams: Team[];
  phases: Phase[];
  currentUser?: Profile;
  mode?: "create" | "edit";
  initialValues?: {
    title?: string;
    description?: string;
    dueDate?: string | null;
    priority?: Priority;
    phaseId?: string | null;
    assigneeIds?: string[];
  };
  /** Set when the project/member context failed to load from Supabase. */
  loadError?: string | null;
  onBack?: () => void;
  onSubmit?: (data: {
    title: string;
    description: string;
    dueDate: string | null;
    priority: Priority;
    projectId: string;
    phaseId: string | null;
    assigneeIds: string[];
  }) => Promise<void> | void;
};

export function CreateTaskScreen({
  project,
  projectMembers,
  friends,
  teams,
  phases,
  currentUser,
  mode = "create",
  initialValues,
  loadError,
  onBack,
  onSubmit,
}: CreateTaskScreenProps) {
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

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [titleFocused, setTitleFocused] = useState(false);
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [dueDate, setDueDate] = useState<Date | null>(
    initialValues?.dueDate ? new Date(`${initialValues.dueDate}T00:00:00`) : null,
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    initialValues?.assigneeIds ?? (currentUser ? [currentUser.id] : []),
  );
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [priority, setPriority] = useState<Priority>(initialValues?.priority ?? "medium");
  const [phaseId, setPhaseId] = useState<string | null>(initialValues?.phaseId ?? phases[0]?.id ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setPhaseId((current) => current ?? initialValues?.phaseId ?? phases[0]?.id ?? null);
  }, [phases, initialValues?.phaseId]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const projectDueDate = project.dueDate ? new Date(`${project.dueDate}T00:00:00`) : null;
  const exceedsProjectDueDate = Boolean(dueDate && projectDueDate && dueDate > projectDueDate);
  const canSubmit = title.trim().length > 0 && !exceedsProjectDueDate;
  const assignableProfiles = [...projectMembers, ...friends].filter(
    (profile, index, all) => all.findIndex((candidate) => candidate.id === profile.id) === index,
  );
  const assignedProfiles = assignableProfiles.filter((member) => assigneeIds.includes(member.id));
  const currentPhase = phases.find((phase) => phase.id === phaseId) ?? null;

  function toggleTeam(team: Team) {
    const memberIds = team.members.map((member) => member.id);
    const allSelected = memberIds.length > 0 && memberIds.every((id) => assigneeIds.includes(id));
    setAssigneeIds((current) =>
      allSelected
        ? current.filter((id) => !memberIds.includes(id))
        : [...new Set([...current, ...memberIds])],
    );
  }

  function cyclePhase() {
    if (phases.length === 0) return;
    const idx = phases.findIndex((phase) => phase.id === phaseId);
    const next = phases[(idx + 1) % phases.length];
    setPhaseId(next.id);
  }

  function toggleAssignee(userId: string) {
    setAssigneeIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function cyclePriority() {
    const nextIndex = (PRIORITY_CYCLE.indexOf(priority) + 1) % PRIORITY_CYCLE.length;
    setPriority(PRIORITY_CYCLE[nextIndex]);
  }

  function handleDateChange(event: { type: string }, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "set" && selectedDate) {
      setDueDate(selectedDate);
    }
  }

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onSubmit?.({
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
        priority,
        projectId: project.id,
        phaseId,
        assigneeIds,
      });
    } catch (error) {
      const fallback =
        mode === "edit"
          ? "Task konnte nicht gespeichert werden. Bitte versuche es erneut."
          : "Task konnte nicht erstellt werden. Bitte versuche es erneut.";
      console.error(fallback, error);
      setErrorMessage(getErrorMessage(error, fallback));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Zurück zur Tasks-Übersicht"
            style={styles.backButton}
          >
            <Text style={styles.backButtonIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{mode === "edit" ? "Task bearbeiten" : "Task erstellen"}</Text>
        </View>
        <View style={styles.headerDivider} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {loadError && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {loadError}
            </Text>
          )}

          <Text style={styles.sectionLabel}>AUFGABE</Text>
          <View
            style={[
              styles.card,
              styles.titleCard,
              titleFocused && styles.titleCardFocused,
            ]}
          >
            <Text style={styles.fieldLabel}>TITEL</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              onFocus={() => setTitleFocused(true)}
              onBlur={() => setTitleFocused(false)}
              placeholder="z. B. Moodboard finalisieren"
              placeholderTextColor={colors.textMutedLight}
              accessibilityLabel="Titel"
            />
          </View>

          <View style={styles.row}>
            <Pressable
              style={[styles.card, styles.halfCard]}
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Fälligkeitsdatum wählen"
            >
              <Text style={styles.fieldLabel}>FÄLLIG</Text>
              <View style={styles.dueRow}>
                <Text style={styles.dueValue}>
                  {dueDate
                    ? dueDate.toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "Datum wählen"}
                </Text>
                <CalendarGlyph />
              </View>
              {projectDueDate && (
                <Text style={styles.dueHint} numberOfLines={1}>
                  Projekt bis{" "}
                  {projectDueDate.toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.card, styles.halfCard]}
              onPress={() => setShowAssigneePicker((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel="Personen zuweisen"
            >
              <Text style={styles.fieldLabel}>ZUWEISEN</Text>
              <View style={styles.dueRow}>
                {assignedProfiles.length > 0 ? (
                  <Avatar
                    name={assignedProfiles[0].full_name}
                    color={assignedProfiles[0].avatar_color}
                    size={26}
                  />
                ) : (
                  <Text style={styles.dueValue}>Niemand</Text>
                )}
                <AddPersonGlyph />
              </View>
            </Pressable>
          </View>

          <Pressable
            style={styles.card}
            onPress={cyclePhase}
            accessibilityRole="button"
            accessibilityLabel={`Phase: ${currentPhase?.name ?? "unbekannt"}. Zum Ändern tippen.`}
          >
            <Text style={styles.fieldLabel}>PHASE</Text>
            <PhaseBadge phaseName={currentPhase?.name} />
          </Pressable>

          {showDatePicker && (
            <DateTimePicker
              value={dueDate ?? projectDueDate ?? new Date()}
              mode="date"
              maximumDate={projectDueDate ?? undefined}
              onChange={handleDateChange}
              accessibilityLabel="Fälligkeitsdatum"
            />
          )}

          {exceedsProjectDueDate && (
            <Text style={styles.errorText} accessibilityRole="alert">
              Das Fälligkeitsdatum darf nicht nach dem Projekt-Abschlussdatum liegen.
            </Text>
          )}

          {showAssigneePicker && (
            <View style={styles.card}>
              {teams.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>TEAMS</Text>
                  <View style={styles.teamChipRow}>
                    {teams.map((team) => {
                      const memberIds = team.members.map((member) => member.id);
                      const isTeamSelected =
                        memberIds.length > 0 && memberIds.every((id) => assigneeIds.includes(id));
                      return (
                        <Pressable
                          key={team.id}
                          onPress={() => toggleTeam(team)}
                          style={[styles.teamChip, isTeamSelected && styles.teamChipSelected]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isTeamSelected }}
                          accessibilityLabel={`Team ${team.name}, ${team.members.length} Mitglieder`}
                        >
                          <Text
                            style={[styles.teamChipText, isTeamSelected && styles.teamChipTextSelected]}
                            numberOfLines={1}
                          >
                            {team.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.fieldLabel}>PERSONEN</Text>
              {assignableProfiles.length === 0 && (
                <Text style={styles.emptyText}>Keine Freunde gefunden.</Text>
              )}
              {assignableProfiles.map((member) => {
                const isSelected = assigneeIds.includes(member.id);
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => toggleAssignee(member.id)}
                    style={styles.memberRow}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={member.full_name ?? "Unbekannter Nutzer"}
                  >
                    <Avatar name={member.full_name} color={member.avatar_color} size={26} />
                    <Text style={styles.memberName}>{member.full_name ?? "Unbekannt"}</Text>
                    {isSelected && <Text style={styles.memberCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.projectRow}>
              <View>
                <Text style={styles.fieldLabel}>PROJEKT</Text>
                <Text style={styles.projectName}>{project.name}</Text>
              </View>
              <Pressable
                onPress={cyclePriority}
                accessibilityRole="button"
                accessibilityLabel={`Priorität: ${priority}. Zum Ändern tippen.`}
              >
                <PriorityBadge priority={priority} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.card, styles.descriptionCard]}>
            <Text style={styles.fieldLabel}>BESCHREIBUNG</Text>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Details zur Aufgabe…"
              placeholderTextColor={colors.textMutedLight}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Beschreibung"
            />
          </View>

          {errorMessage && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errorMessage}
            </Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={mode === "edit" ? "Änderungen speichern" : "Task erstellen"}
            accessibilityState={{ disabled: !canSubmit || isSubmitting }}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              (!canSubmit || isSubmitting) && styles.submitButtonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === "edit" ? "ÄNDERUNGEN SPEICHERN" : "TASK ERSTELLEN"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CalendarGlyph() {
  return (
    <View style={glyphStyles.calendar}>
      <View style={glyphStyles.calendarTop} />
    </View>
  );
}

function AddPersonGlyph() {
  return (
    <View style={glyphStyles.addPerson}>
      <View style={glyphStyles.addPersonH} />
      <View style={glyphStyles.addPersonV} />
    </View>
  );
}

const CARD_RADIUS = 15;

const styles = StyleSheet.create({
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
  headerTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 18,
    color: colors.ink,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginTop: Spacing.two,
  },
  scrollContent: {
    paddingHorizontal: 19,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  sectionLabel: {
    fontFamily: "DMMono_500Medium",
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textMuted,
    marginBottom: -Spacing.two,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: "transparent",
    padding: Spacing.three,
  },
  titleCard: {
    gap: 4,
  },
  titleCardFocused: {
    borderColor: colors.brandOrange,
  },
  fieldLabel: {
    fontFamily: "DMMono_500Medium",
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.textMutedLight,
  },
  titleInput: {
    fontFamily: "DMSans_500Medium",
    fontSize: 16,
    color: colors.ink,
    padding: 0,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  halfCard: {
    flex: 1,
    gap: Spacing.two,
  },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dueValue: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.brandOrange,
  },
  dueHint: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: colors.textMutedLight,
    marginTop: 4,
  },
  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  projectName: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
    color: colors.ink,
    marginTop: 2,
  },
  descriptionCard: {
    gap: Spacing.two,
    minHeight: 120,
  },
  descriptionInput: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  teamChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  teamChip: {
    backgroundColor: colors.warmCream,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    maxWidth: 160,
  },
  teamChipSelected: {
    backgroundColor: colors.brandOrange,
  },
  teamChipText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: colors.ink,
  },
  teamChipTextSelected: {
    color: "#FFFFFF",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  memberName: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.ink,
  },
  memberCheck: {
    color: colors.brandOrange,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: Spacing.two,
  },
  errorText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.priorityHighText,
    textAlign: "center",
  },
  submitButton: {
    height: 49,
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.two,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 14,
    letterSpacing: 1,
    color: "#FFFFFF",
  },
});

const glyphStyles = StyleSheet.create({
  calendar: {
    width: 16,
    height: 15,
    borderWidth: 1.4,
    borderColor: colors.brandOrange,
    borderRadius: 3,
    justifyContent: "flex-start",
  },
  calendarTop: {
    height: 3.5,
    borderBottomWidth: 1.4,
    borderColor: colors.brandOrange,
  },
  addPerson: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addPersonH: {
    position: "absolute",
    width: 14,
    height: 1.6,
    backgroundColor: colors.brandOrange,
    borderRadius: 1,
  },
  addPersonV: {
    position: "absolute",
    width: 1.6,
    height: 14,
    backgroundColor: colors.brandOrange,
    borderRadius: 1,
  },
});
