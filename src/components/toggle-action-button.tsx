import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "@/theme/colors";

export type ToggleActionButtonProps = {
  icon: ReactNode;
  label: string;
  active: boolean;
  onToggle: () => void;
};

export function ToggleActionButton({ icon, label, active, onToggle }: ToggleActionButtonProps) {
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

const styles = StyleSheet.create({
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
    backgroundColor: "#FFFFFF",
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
