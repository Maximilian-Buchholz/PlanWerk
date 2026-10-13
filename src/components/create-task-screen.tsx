import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState, useMemo } from "react";
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
import { AvatarStack } from "@/components/avatar-stack";
import { DatePickerSheet } from "@/components/date-picker-sheet";
import { Spacing } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errors";
import type { Team } from "@/lib/teams";
import type { Palette } from "@/theme/colors";
import { useColors } from "@/theme/theme-context";
import type { Phase, Priority, Profile } from "@/types/tasks";

SplashScreen.preventAutoHideAsync().catch(() => {});


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
  // Priority is no longer editable here; it keeps its initial/existing value.
  const [priority] = useState<Priority>(initialValues?.priority ?? "medium");
  const [phaseId, setPhaseId] = useState<string | null>(initialValues?.phaseId ?? phases[0]?.id ?? null);
  // One shared font size for every phase chip, derived from the widest name that has to fit.
  const [phaseRowWidth, setPhaseRowWidth] = useState(0);
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
  const longestPhaseName = phases.reduce((max, phase) => Math.max(max, phase.name.length), 1);
  const phaseChipInnerWidth =
    phases.length > 0
      ? (phaseRowWidth - Spacing.two * (phases.length - 1)) / phases.length - Spacing.two
      : 0;
  // DM Mono is monospaced: a glyph is about 0.6em wide plus the 0.3 letter spacing.
  const phaseFontSize =
    phaseRowWidth > 0
      ? Math.max(8, Math.min(12, Math.floor((phaseChipInnerWidth - 1) / (longestPhaseName * 0.6 + 0.3))))
      : 11;
  const assignableProfiles = [...projectMembers, ...friends].filter(
    (profile, index, all) => all.findIndex((candidate) => candidate.id === profile.id) === index,
  );
  const assignedProfiles = assignableProfiles.filter((member) => assigneeIds.includes(member.id));

  function toggleTeam(team: Team) {
    const memberIds = team.members.map((member) => member.id);
    const allSelected = memberIds.length > 0 && memberIds.every((id) => assigneeIds.includes(id));
    setAssigneeIds((current) =>
      allSelected
        ? current.filter((id) => !memberIds.includes(id))
        : [...new Set([...current, ...memberIds])],
    );
  }

  function toggleAssignee(userId: string) {
    setAssigneeIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
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
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>PROJEKT</Text>
            <Text style={styles.projectName}>{project.name}</Text>
          </View>

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
                  <AvatarStack profiles={assignedProfiles} size={26} max={2} />
                ) : (
                  <Text style={styles.dueValue}>Niemand</Text>
                )}
                <AddPersonGlyph />
              </View>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>PHASE</Text>
            <View
              style={styles.phaseRow}
              accessibilityRole="radiogroup"
              onLayout={(event) => setPhaseRowWidth(event.nativeEvent.layout.width)}
            >
              {phases.map((phase) => {
                const isSelected = phase.id === phaseId;
                return (
                  <Pressable
                    key={phase.id}
                    onPress={() => setPhaseId(phase.id)}
                    style={[styles.phaseChip, isSelected && styles.phaseChipSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Phase ${phase.name}`}
                  >
                    <Text
                      style={[
                        styles.phaseChipText,
                        { fontSize: phaseFontSize },
                        isSelected && styles.phaseChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {phase.name.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <DatePickerSheet
            visible={showDatePicker}
            value={dueDate ?? projectDueDate ?? new Date()}
            maximumDate={projectDueDate ?? undefined}
            accessibilityLabel="Fälligkeitsdatum"
            onConfirm={(date) => {
              setDueDate(date);
              setShowDatePicker(false);
            }}
            onCancel={() => setShowDatePicker(false)}
          />

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
  const colors = useColors();
  const glyphStyles = useMemo(() => makeGlyphStyles(colors), [colors]);
  return (
    <View style={glyphStyles.calendar}>
      <View style={glyphStyles.calendarTop} />
    </View>
  );
}

function AddPersonGlyph() {
  const colors = useColors();
  const glyphStyles = useMemo(() => makeGlyphStyles(colors), [colors]);
  return (
    <View style={glyphStyles.addPerson}>
      <View style={glyphStyles.addPersonH} />
      <View style={glyphStyles.addPersonV} />
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
      backgroundColor: colors.surface,
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
    phaseRow: {
      flexDirection: "row",
      gap: Spacing.two,
    },
    phaseChip: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.one,
      borderRadius: 10,
      // Transparent until selected, so choosing a phase doesn't shift the layout.
      borderWidth: 1.5,
      borderColor: "transparent",
      backgroundColor: colors.warmCream,
    },
    phaseChipSelected: {
      borderColor: colors.brandOrange,
    },
    phaseChipText: {
      fontFamily: "DMMono_500Medium",
      letterSpacing: 0.3,
      color: colors.textMuted,
    },
    phaseChipTextSelected: {
      color: colors.ink,
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

const makeGlyphStyles = (colors: Palette) =>
  StyleSheet.create({
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
