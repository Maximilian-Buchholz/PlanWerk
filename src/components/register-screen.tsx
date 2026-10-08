import { DMMono_500Medium } from "@expo-google-fonts/dm-mono";
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

import { Spacing } from "@/constants/theme";
import { colors } from "@/theme/colors";

// The root layout already hides the native splash screen on first paint (see
// `AnimatedSplashOverlay`). This call is a defensive no-op guard so this
// screen still avoids a flash of unstyled text if it is ever mounted before
// that has happened (e.g. as an entry point in a different navigation flow).
SplashScreen.preventAutoHideAsync().catch(() => {});

const MIN_PASSWORD_LENGTH = 8;

type PasswordRequirement = {
  label: string;
  met: boolean;
};

function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      label: `Mind. ${MIN_PASSWORD_LENGTH} Zeichen`,
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
    {
      label: "Groß- und Kleinschreibung",
      met: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { label: "Mind. 1 Zahl", met: /[0-9]/.test(password) },
    { label: "Mind. 1 Sonderzeichen", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export type RegisterScreenProps = {
  onSubmit?: (data: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void> | void;
  onLogin?: () => void;
};

export function RegisterScreen({ onSubmit, onLogin }: RegisterScreenProps) {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // TODO: Name-Wert als user_metadata an supabase.auth.signUp() übergeben,
  //       z. B. options: { data: { display_name: name } }, damit er in der
  //       App als Anzeigename verwendet werden kann
  const [name, setName] = useState("");
  // TODO: E-Mail-Wert an supabase.auth.signUp() übergeben
  const [email, setEmail] = useState("");
  // TODO: Passwort-Wert an supabase.auth.signUp() übergeben (die unten
  //       geprüften Regeln sind nur clientseitiges UX-Feedback — Supabase
  //       sollte serverseitig eine eigene Passwort-Policy erzwingen)
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // TODO: Wird nur clientseitig zum Abgleich mit `password` verwendet und nie
  //       an Supabase übergeben
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const passwordRequirements = useMemo(
    () => getPasswordRequirements(password),
    [password],
  );
  const isPasswordValid = passwordRequirements.every(
    (requirement) => requirement.met,
  );
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const showPasswordMismatch = confirmPassword.length > 0 && !passwordsMatch;
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    isPasswordValid &&
    passwordsMatch;

  if (!fontsLoaded && !fontError) {
    return null;
  }

  async function handleRegister() {
    if (isSubmitting || !canSubmit) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onSubmit?.({ name, email, password });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Registrierung fehlgeschlagen. Bitte versuche es erneut.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogin() {
    onLogin?.();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={handleLogin}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Zurück zum Login"
            style={styles.backButton}
          >
            <Text style={styles.backButtonIcon}>‹</Text>
          </Pressable>

          {/* TODO: Logo einfügen, sobald final */}
          <View style={styles.logoPlaceholder} />

          <Text style={styles.heading}>Konto erstellen.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Max Buchholz"
              placeholderTextColor={mutedInk(0.4)}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              accessibilityLabel="Name"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>E-MAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="max@buchholz.de"
              placeholderTextColor={mutedInk(0.4)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="E-Mail"
            />
          </View>

          <View style={[styles.fieldGroup, styles.passwordFieldGroup]}>
            <Text style={styles.label}>PASSWORT</Text>
            <View style={styles.passwordFieldWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={mutedInk(0.4)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                textContentType="newPassword"
                accessibilityLabel="Passwort"
                accessibilityHint="Mindestens acht Zeichen, Groß- und Kleinschreibung, eine Zahl und ein Sonderzeichen"
              />
              <Pressable
                onPress={() => setShowPassword((value) => !value)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Passwort verbergen" : "Passwort anzeigen"
                }
                style={styles.showPasswordToggle}
              >
                <Text style={styles.showPasswordToggleText}>
                  {showPassword ? "VERBERGEN" : "ANZEIGEN"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PASSWORT WIEDERHOLEN</Text>
            <View style={styles.passwordFieldWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={mutedInk(0.4)}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                textContentType="newPassword"
                accessibilityLabel="Passwort wiederholen"
              />
              <Pressable
                onPress={() => setShowConfirmPassword((value) => !value)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirmPassword
                    ? "Passwort verbergen"
                    : "Passwort anzeigen"
                }
                style={styles.showPasswordToggle}
              >
                <Text style={styles.showPasswordToggleText}>
                  {showConfirmPassword ? "VERBERGEN" : "ANZEIGEN"}
                </Text>
              </Pressable>
            </View>
            {showPasswordMismatch && (
              <Text style={styles.passwordMismatchText}>
                Passwörter stimmen nicht überein
              </Text>
            )}
          </View>

          <View style={styles.requirementsList}>
            {passwordRequirements.map((requirement) => (
              <View key={requirement.label} style={styles.requirementRow}>
                <Text
                  style={[
                    styles.requirementMark,
                    requirement.met
                      ? styles.requirementMarkMet
                      : styles.requirementMarkUnmet,
                  ]}
                >
                  {requirement.met ? "✓" : "○"}
                </Text>
                <Text
                  style={[
                    styles.requirementLabel,
                    requirement.met
                      ? styles.requirementLabelMet
                      : styles.requirementLabelUnmet,
                  ]}
                >
                  {requirement.label}
                </Text>
              </View>
            ))}
          </View>

          {errorMessage && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errorMessage}
            </Text>
          )}

          <Pressable
            onPress={handleRegister}
            disabled={isSubmitting || !canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Konto erstellen"
            accessibilityState={{ disabled: isSubmitting || !canSubmit }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              (isSubmitting || !canSubmit) && styles.primaryButtonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>KONTO ERSTELLEN</Text>
            )}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Schon ein Konto? </Text>
            <Pressable
              onPress={handleLogin}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="Anmelden"
            >
              <Text style={styles.footerLink}>Anmelden</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function mutedInk(opacity: number) {
  return `rgba(44, 44, 44, ${opacity})`;
}

const FIELD_RADIUS = 7;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.warmCream,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 46,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.five,
  },
  backButton: {
    position: "absolute",
    top: Spacing.one,
    left: 46,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  backButtonIcon: {
    fontSize: 30,
    lineHeight: 30,
    color: colors.ink,
  },
  logoPlaceholder: {
    alignSelf: "center",
    width: 175,
    height: 90,
    marginBottom: Spacing.three,
  },
  heading: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    marginBottom: Spacing.five,
  },
  fieldGroup: {
    marginBottom: Spacing.five,
  },
  passwordFieldGroup: {
    marginBottom: Spacing.two,
  },
  label: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    letterSpacing: 0.5,
    color: mutedInk(0.55),
    marginBottom: Spacing.two,
  },
  input: {
    height: 49,
    borderRadius: FIELD_RADIUS,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.three,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    color: colors.ink,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  passwordFieldWrapper: {
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 92,
  },
  showPasswordToggle: {
    position: "absolute",
    right: Spacing.three,
  },
  showPasswordToggleText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.brandOrange,
  },
  requirementsList: {
    marginBottom: Spacing.four,
    gap: 4,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  requirementMark: {
    fontSize: 12,
    width: 14,
    textAlign: "center",
  },
  requirementMarkMet: {
    color: colors.ink,
  },
  requirementMarkUnmet: {
    color: mutedInk(0.35),
  },
  requirementLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
  },
  requirementLabelMet: {
    color: colors.ink,
  },
  requirementLabelUnmet: {
    color: mutedInk(0.45),
  },
  passwordMismatchText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.brandOrange,
    marginTop: Spacing.two,
  },
  errorText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.brandOrange,
    textAlign: "center",
    marginBottom: Spacing.three,
  },
  primaryButton: {
    height: 49,
    borderRadius: FIELD_RADIUS,
    backgroundColor: colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.four,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 14,
    letterSpacing: 1,
    color: "#FFFFFF",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  footerText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: mutedInk(0.6),
  },
  footerLink: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.brandOrange,
  },
});
