import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { colors } from "@/theme/colors";

export type SettingsRowProps = {
  icon: ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function SettingsRow({ icon, label, value, onPress, accessibilityLabel }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <View style={styles.iconCircle}>{icon}</View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {value && <Text style={styles.value}>{value}</Text>}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.warmCream,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    color: colors.ink,
  },
  value: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 20,
    color: colors.textMutedLight,
    marginLeft: 2,
  },
});
