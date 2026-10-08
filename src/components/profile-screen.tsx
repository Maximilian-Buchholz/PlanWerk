import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { SettingsRow } from "@/components/settings-row";
import { ToggleActionButton } from "@/components/toggle-action-button";
import { Spacing } from "@/constants/theme";
import { Icon } from "@/components/icons";
import { colors } from "@/theme/colors";
import type { Profile } from "@/types/tasks";

SplashScreen.preventAutoHideAsync().catch(() => {});

export type ProfileScreenProps = {
  profile?: Profile | null;
  /** From `auth.users` — there is no email column on `profiles`. */
  email?: string | null;
  /** Set when the profile failed to load from Supabase. */
  loadError?: string | null;
  onBack?: () => void;
  onEditProfile?: () => void;
  onPressTeamManagement?: () => void;
  onSignOut?: () => void;
  /** Persist a changed status flag; the screen updates optimistically. */
  onChangeStatus?: (status: { is_do_not_disturb?: boolean; is_out_of_office?: boolean }) => void;
};

export function ProfileScreen({
  profile,
  email,
  loadError,
  onBack,
  onEditProfile,
  onPressTeamManagement,
  onSignOut,
  onChangeStatus,
}: ProfileScreenProps) {
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

  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [outOfOffice, setOutOfOffice] = useState(false);

  // The profile arrives asynchronously — mirror its saved status into local state.
  useEffect(() => {
    setDoNotDisturb(profile?.is_do_not_disturb ?? false);
    setOutOfOffice(profile?.is_out_of_office ?? false);
  }, [profile?.is_do_not_disturb, profile?.is_out_of_office]);

  const toggleStatus = (key: "is_do_not_disturb" | "is_out_of_office") => {
    const next = key === "is_do_not_disturb" ? !doNotDisturb : !outOfOffice;
    (key === "is_do_not_disturb" ? setDoNotDisturb : setOutOfOffice)(next);
    onChangeStatus?.({ [key]: next });
  };

  // TODO: Kein Spalten-Pendant in schema.sql. Optionen: (a) System-
  // Berechtigung via expo-notifications auslesen (Notifications.
  // getPermissionsAsync()) und nur anzeigen, nicht speichern, oder (b)
  // zusätzliche Spalte push_enabled boolean in profiles für eine App-interne
  // Präferenz. Navigation (Chevron) → eigener Einstellungs-Screen mit Toggle.
  const [pushEnabled] = useState(true);

  // TODO: Keine Spalte in schema.sql. Sprachwahl vermutlich App-/Device-
  // seitig (z. B. i18n-Lib + AsyncStorage), optional zusätzlich in profiles
  // persistieren (preferred_language text), falls geräteübergreifend
  // gewünscht. Navigation → Sprachauswahl-Screen/-Modal.
  const [language] = useState("Deutsch");

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
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
        <Text style={styles.headerTitle}>Profil</Text>
        <View style={styles.headerSpacer} />
        <Avatar name={profile?.full_name ?? null} color="#000000" shape="square" size={40} />
      </View>
      <View style={styles.headerDivider} />

      <View style={styles.content}>
        {loadError && (
          <Text style={styles.errorText} accessibilityRole="alert">
            {loadError}
          </Text>
        )}

        <View style={styles.profileCard}>
          <Avatar name={profile?.full_name ?? null} color="#000000" shape="square" size={56} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile?.full_name ?? "Unbekannt"}
            </Text>
            {email && (
              <Text style={styles.profileEmail} numberOfLines={1}>
                {email}
              </Text>
            )}
          </View>
          <Pressable
            onPress={onEditProfile}
            style={styles.editButton}
            accessibilityRole="button"
            accessibilityLabel="Profil bearbeiten"
          >
            <Text style={styles.editButtonText}>Bearbeiten</Text>
          </Pressable>
        </View>

        <View style={styles.toggleRow}>
          <ToggleActionButton
            icon={<Icon name="moon" size={24} color={doNotDisturb ? "#FFFFFF" : colors.textMuted} />}
            label="Nicht stören"
            active={doNotDisturb}
            onToggle={() => toggleStatus("is_do_not_disturb")}
          />
          <ToggleActionButton
            icon={<Icon name="briefcase" size={24} color={outOfOffice ? "#FFFFFF" : colors.textMuted} />}
            label="Out of office"
            active={outOfOffice}
            onToggle={() => toggleStatus("is_out_of_office")}
          />
        </View>

        <Text style={styles.sectionLabel}>EINSTELLUNGEN</Text>
        <View style={styles.settingsCard}>
          <SettingsRow
            icon={<Icon name="bell" size={22} color={colors.brandOrange} />}
            label="Push Benachrichtigung"
            value={pushEnabled ? "An" : "Aus"}
          />
          <View style={styles.rowDivider} />
          <SettingsRow icon={<Icon name="globe" size={22} color={colors.brandOrange} />} label="Sprache" value={language} />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Icon name="teams" size={22} color={colors.brandOrange} />}
            label="Teamverwaltung"
            onPress={onPressTeamManagement}
          />
        </View>

        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel="Abmelden"
          style={styles.signOutButton}
        >
          <Text style={styles.signOutText}>ABMELDEN</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

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
  content: {
    flex: 1,
    paddingHorizontal: 19,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  errorText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.priorityHighText,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: Spacing.three,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 18,
    color: colors.ink,
  },
  profileEmail: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
  editButton: {
    backgroundColor: "rgba(232, 90, 26, 0.12)",
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  editButtonText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: colors.brandOrange,
  },
  toggleRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  sectionLabel: {
    fontFamily: "DMMono_500Medium",
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textMuted,
    marginBottom: -Spacing.two,
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 19 + 34 + Spacing.two,
  },
  signOutButton: {
    alignItems: "center",
    paddingVertical: Spacing.three,
  },
  signOutText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 13,
    letterSpacing: 1,
    color: colors.brandOrange,
  },
});
