import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import type { Priority } from "@/types/tasks";

const PRIORITY_STYLES: Record<Priority, { text: string; bg: string }> = {
  high: { text: colors.priorityHighText, bg: colors.priorityHighBg },
  medium: { text: colors.priorityMediumText, bg: colors.priorityMediumBg },
  low: { text: colors.priorityLowText, bg: colors.priorityLowBg },
};

export type PriorityBadgeProps = {
  priority: Priority;
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { text, bg } = PRIORITY_STYLES[priority];

  return (
    <View
      style={[styles.badge, { backgroundColor: bg }]}
      accessibilityLabel={`Priorität: ${priority}`}
    >
      <Text style={[styles.text, { color: text }]}>{priority.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 20,
    borderRadius: 6,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  text: {
    fontFamily: "DMMono_500Medium",
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
