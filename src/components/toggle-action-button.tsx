import { useMemo } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import type { Palette } from "@/theme/colors";
import { useColors } from "@/theme/theme-context";

export type ToggleActionButtonProps = {
  icon: ReactNode;
  label: string;
  active: boolean;
  onToggle: () => void;
};

export function ToggleActionButton({ icon, label, active, onToggle }: ToggleActionButtonProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.button,
        active ? styles.buttonActive : styles.buttonInactive,
        pressed && styles.buttonPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      {icon}
      <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    button: {
      flex: 1,
      height: 49,
      borderRadius: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    buttonActive: {
      backgroundColor: colors.brandOrange,
    },
    buttonInactive: {
      backgroundColor: colors.surface,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    label: {
      fontFamily: "DMSans_500Medium",
      fontSize: 15,
    },
    labelActive: {
      color: "#FFFFFF",
    },
    labelInactive: {
      color: colors.textMuted,
    },
  });
