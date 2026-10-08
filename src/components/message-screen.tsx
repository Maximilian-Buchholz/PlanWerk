import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
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

import { Avatar } from "@/components/avatar";
import { Spacing } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errors";
import { colors } from "@/theme/colors";
import type { Profile } from "@/types/tasks";

SplashScreen.preventAutoHideAsync().catch(() => {});

/** How long the "Gesendet" confirmation stays visible before the screen closes. */
const SENT_CONFIRMATION_MS = 1200;

export type MessageScreenProps = {
  recipient: Pick<Profile, "id" | "full_name" | "avatar_color">;
  onBack?: () => void;
  onSend?: (body: string) => Promise<void> | void;
};

export function MessageScreen({ recipient, onBack, onSend }: MessageScreenProps) {
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

  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const canSend = body.trim().length > 0 && !isSent;

  async function handleSend() {
    if (!canSend || isSending) return;
    setErrorMessage(null);
    setIsSending(true);
    try {
      await onSend?.(body.trim());
      setIsSent(true);
      closeTimer.current = setTimeout(() => onBack?.(), SENT_CONFIRMATION_MS);
    } catch (error) {
      console.error("Nachricht konnte nicht gesendet werden:", error);
      setErrorMessage(getErrorMessage(error, "Nachricht konnte nicht gesendet werden. Bitte versuche es erneut."));
    } finally {
      setIsSending(false);
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
            accessibilityLabel="Zurück"
            style={styles.backButton}
          >
            <Text style={styles.backButtonIcon}>‹</Text>
          </Pressable>
          <Avatar name={recipient.full_name} color={recipient.avatar_color} shape="square" size={32} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {recipient.full_name ?? "Unbekannt"}
          </Text>
        </View>
        <View style={styles.headerDivider} />

        <View style={styles.content}>
          <Text style={styles.sectionLabel}>NACHRICHT</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.bodyInput}
              value={body}
              onChangeText={setBody}
              placeholder="Was möchtest du sagen?"
              placeholderTextColor={colors.textMutedLight}
              multiline
              textAlignVertical="top"
              autoFocus
              editable={!isSent}
              accessibilityLabel="Nachrichtentext"
            />
          </View>

          {errorMessage && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errorMessage}
            </Text>
          )}

          <Pressable
            onPress={handleSend}
            disabled={!canSend || isSending}
            accessibilityRole="button"
            accessibilityLabel={isSent ? "Nachricht gesendet" : "Nachricht senden"}
            accessibilityState={{ disabled: !canSend || isSending }}
            style={({ pressed }) => [
              styles.sendButton,
              isSent && styles.sendButtonSent,
              pressed && styles.sendButtonPressed,
              !isSent && (!canSend || isSending) && styles.sendButtonDisabled,
            ]}
          >
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : isSent ? (
              <Text style={styles.sendButtonText}>✓ NACHRICHT GESENDET</Text>
            ) : (
              <Text style={styles.sendButtonText}>SENDEN</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    flex: 1,
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
    flex: 1,
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
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    padding: Spacing.three,
    minHeight: 160,
  },
  bodyInput: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: colors.ink,
    padding: 0,
  },
  errorText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.priorityHighText,
    textAlign: "center",
  },
  sendButton: {
    height: 49,
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.three,
  },
  sendButtonSent: {
    backgroundColor: colors.phaseDone,
  },
  sendButtonPressed: {
    opacity: 0.85,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 14,
    letterSpacing: 1,
    color: "#FFFFFF",
  },
});
