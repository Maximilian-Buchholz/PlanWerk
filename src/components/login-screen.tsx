import {
  DMMono_400Regular,
  DMMono_500Medium,
} from "@expo-google-fonts/dm-mono";
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

import { Spacing } from "@/constants/theme";
import { colors } from "@/theme/colors";

// The root layout already hides the native splash screen on first paint (see
// `AnimatedSplashOverlay`). This call is a defensive no-op guard so this
// screen still avoids a flash of unstyled text if it is ever mounted before
// that has happened (e.g. as an entry point in a different navigation flow).
SplashScreen.preventAutoHideAsync().catch(() => {});

export type LoginScreenProps = {
  /**
   * TODO: username aus Supabase-Session (aktueller User) einsetzen, z. B. via useAuth()-Context
   */
  username?: string;
  onSubmit?: (credentials: {
    email: string;
    password: string;
    rememberMe: boolean;
  }) => Promise<void> | void;
  onForgotPassword?: () => void;
  onSsoLogin?: () => void;
  onCreateAccount?: () => void;
};

export function LoginScreen({
  username,
  onSubmit,
  onForgotPassword,
  onSsoLogin,
  onCreateAccount,
}: LoginScreenProps) {
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

  // TODO: E-Mail-Wert an supabase.auth.signInWithPassword() übergeben
  const [email, setEmail] = useState("");
  // TODO: Passwort-Wert an supabase.auth.signInWithPassword() übergeben
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // TODO: Session-Persistenz steuern (Supabase persistiert standardmäßig via
  //       AsyncStorage — hier ggf. SecureStore als Alternative prüfen)
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const heading = username
    ? `Willkommen zurück, ${username}.`
    : "Willkommen zurück.";

  async function handleLogin() {
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onSubmit?.({ email, password, rememberMe });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSsoLogin() {
    // TODO: supabase.auth.signInWithOAuth({ provider: '...' }) anbinden,
    //       Provider je nach gewünschtem SSO-Anbieter (Google/Apple/etc.) ergänzen
    onSsoLogin?.();
  }

  function handleForgotPassword() {
    // TODO: Navigation zu Passwort-Reset-Flow (supabase.auth.resetPasswordForEmail) einbauen
    onForgotPassword?.();
  }

  function handleCreateAccount() {
    // TODO: Navigation zur Registrierungs-Screen (Supabase signUp) einbauen
    onCreateAccount?.();
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
          {/* TODO: Logo einfügen, sobald final */}
          <View style={styles.logoPlaceholder} />

          <Text style={styles.heading}>{heading}</Text>

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

          <View style={[styles.fieldGroup, styles.fieldGroupSpaced]}>
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
                autoComplete="password"
                textContentType="password"
                accessibilityLabel="Passwort"
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

          <View style={styles.optionsRow}>
            <Pressable
              onPress={() => setRememberMe((value) => !value)}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
              accessibilityLabel="Angemeldet bleiben"
              style={styles.rememberMeRow}
            >
              <View
                style={[styles.checkbox, rememberMe && styles.checkboxChecked]}
              >
                {rememberMe && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.rememberMeLabel}>Angemeldet bleiben</Text>
            </Pressable>

            <Pressable
              onPress={handleForgotPassword}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="Passwort vergessen"
            >
              <Text style={styles.forgotPasswordLink}>Vergessen?</Text>
            </Pressable>
          </View>

          {errorMessage && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errorMessage}
            </Text>
          )}

          <Pressable
            onPress={handleLogin}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Anmelden"
            accessibilityState={{ disabled: isSubmitting }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              isSubmitting && styles.primaryButtonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>ANMELDEN</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ODER</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={handleSsoLogin}
            accessibilityRole="button"
            accessibilityLabel="Mit SSO anmelden"
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Mit SSO anmelden</Text>
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Neu hier? </Text>
            <Pressable
              onPress={handleCreateAccount}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="Konto erstellen"
            >
              <Text style={styles.footerLink}>Konto erstellen</Text>
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
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },
  logoPlaceholder: {
    alignSelf: "center",
    width: 175,
    height: 90,
    marginBottom: Spacing.four,
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
  fieldGroupSpaced: {
    marginBottom: Spacing.four,
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
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.four,
  },
  rememberMeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  checkbox: {
    width: 15,
    height: 15,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: mutedInk(0.3),
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.brandOrange,
    borderColor: colors.brandOrange,
  },
  checkboxMark: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
  rememberMeLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.ink,
  },
  forgotPasswordLink: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.brandOrange,
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
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 14,
    letterSpacing: 1,
    color: "#FFFFFF",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0DAD0",
  },
  dividerText: {
    fontFamily: "DMMono_400Regular",
    fontSize: 12,
    letterSpacing: 1,
    color: mutedInk(0.55),
  },
  secondaryButton: {
    height: 49,
    borderRadius: FIELD_RADIUS,
    backgroundColor: "rgba(224, 218, 208, 0.44)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.four,
  },
  secondaryButtonPressed: {
    opacity: 0.7,
  },
  secondaryButtonText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 14,
    color: colors.ink,
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
