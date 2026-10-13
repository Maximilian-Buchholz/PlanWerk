import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useRef, useState, useMemo } from "react";
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Spacing } from "@/constants/theme";
import type { Palette } from "@/theme/colors";
import { useColors, useTheme } from "@/theme/theme-context";

export type DatePickerSheetProps = {
  visible: boolean;
  /** Date shown when the picker opens. */
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  accessibilityLabel?: string;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
};

function clamp(date: Date, min?: Date, max?: Date): Date {
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
}

/**
 * One-step date picker: tapping the field opens a window with the date wheels
 * right away (iOS) or the system dialog (Android) — no extra date chip to tap first.
 */
export function DatePickerSheet({
  visible,
  value,
  minimumDate,
  maximumDate,
  accessibilityLabel,
  onConfirm,
  onCancel,
}: DatePickerSheetProps) {
  const { isDark } = useTheme();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [draft, setDraft] = useState(() => clamp(value, minimumDate, maximumDate));

  // Start from the current value each time the window opens.
  useEffect(() => {
    if (visible) setDraft(clamp(value, minimumDate, maximumDate));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same motion as the "Freund hinzufügen" sheet: the backdrop fades in/out while
  // the sheet itself slides a short distance. (Modal's own "slide" would drag the
  // dark backdrop up from the bottom, so the Modal runs without animation.)
  const [isMounted, setIsMounted] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(320)).current;

  useEffect(() => {
    if (Platform.OS === "android") return;
    if (visible) {
      setIsMounted(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 320, duration: 180, useNativeDriver: true }),
      ]).start(() => setIsMounted(false));
    }
  }, [visible, overlayOpacity, sheetTranslateY]);

  if (Platform.OS === "android") {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={draft}
        mode="date"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        accessibilityLabel={accessibilityLabel}
        onChange={(event, selected) => {
          if (event.type === "set" && selected) onConfirm(selected);
          else onCancel();
        }}
      />
    );
  }

  return (
    <Modal visible={isMounted} transparent animationType="none" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: overlayOpacity }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Schließen" />
        <Animated.View style={{ transform: [{ translateY: sheetTranslateY }] }}>
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button">
              <Text style={styles.cancelText}>Abbrechen</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(draft)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.confirmText}>Fertig</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draft}
            mode="date"
            display="spinner"
            locale="de-DE"
            themeVariant={isDark ? "dark" : "light"}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_event, selected) => {
              if (selected) setDraft(selected);
            }}
            accessibilityLabel={accessibilityLabel}
          />
        </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.4)",
    },
    sheet: {
      backgroundColor: colors.warmCream,
      borderTopLeftRadius: 15,
      borderTopRightRadius: 15,
      paddingTop: Spacing.three,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 19,
    },
    cancelText: {
      fontFamily: "DMSans_500Medium",
      fontSize: 16,
      color: colors.textMuted,
    },
    confirmText: {
      fontFamily: "DMSans_600SemiBold",
      fontSize: 16,
      color: colors.brandOrange,
    },
  });
