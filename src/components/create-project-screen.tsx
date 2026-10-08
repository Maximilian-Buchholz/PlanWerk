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
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Spacing } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errors";
import { colors } from "@/theme/colors";

SplashScreen.preventAutoHideAsync().catch(() => {});

export type CreateProjectScreenProps = {
  onBack?: () => void;
  onSubmit?: (data: { name: string; dueDate: string | null }) => Promise<void> | void;
};

export function CreateProjectScreen({ onBack, onSubmit }: CreateProjectScreenProps) {
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

  const [name, setName] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const canSubmit = name.trim().length > 0;

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
        name: name.trim(),
        dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
      });
    } catch (error) {
      console.error("Projekt konnte nicht erstellt werden:", error);
      setErrorMessage(
        getErrorMessage(error, "Projekt konnte nicht erstellt werden. Bitte versuche es erneut."),
      );
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
            accessibilityLabel="Zurück zur Projektübersicht"
            style={styles.backButton}
          >
            <Text style={styles.backButtonIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Projekt erstellen</Text>
        </View>
        <View style={styles.headerDivider} />

        <View style={styles.content}>
          <Text style={styles.sectionLabel}>PROJEKT</Text>
          <View style={[styles.card, nameFocused && styles.cardFocused]}>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              placeholder="z. B. Marketing Kampagne"
              placeholderTextColor={colors.textMutedLight}
              accessibilityLabel="Projektname"
            />
          </View>

          <Pressable
            style={styles.card}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
            accessibilityLabel="Abschlussdatum wählen"
          >
            <Text style={styles.fieldLabel}>ABSCHLUSS BIS</Text>
            <View style={styles.dueRow}>
              <Text style={styles.dueValue}>
                {dueDate
                  ? dueDate.toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "Kein Datum gesetzt"}
              </Text>
              <CalendarGlyph />
            </View>
          </Pressable>

          {showDatePicker && (
            <DateTimePicker
              value={dueDate ?? new Date()}
              mode="date"
              minimumDate={new Date()}
              onChange={handleDateChange}
              accessibilityLabel="Abschlussdatum"
            />
          )}

          {errorMessage && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errorMessage}
            </Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Projekt erstellen"
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
              <Text style={styles.submitButtonText}>PROJEKT ERSTELLEN</Text>
            )}
          </Pressable>
        </View>
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
  content: {
    paddingHorizontal: 19,
    paddingTop: Spacing.four,
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
    gap: 4,
  },
  cardFocused: {
    borderColor: colors.brandOrange,
  },
  fieldLabel: {
    fontFamily: "DMMono_500Medium",
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.textMutedLight,
  },
  nameInput: {
    fontFamily: "DMSans_500Medium",
    fontSize: 16,
    color: colors.ink,
    padding: 0,
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
});
