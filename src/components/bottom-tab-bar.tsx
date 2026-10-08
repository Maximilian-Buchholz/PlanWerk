import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/icons";
import { colors } from "@/theme/colors";

export type TabKey = "teams" | "postfach" | "tasks" | "kalender";

export type BottomTabBarProps = {
  active: TabKey;
  onNavigate?: (tab: TabKey) => void;
  /** Unread counts per tab; a tab with a count above zero shows a badge. */
  badges?: Partial<Record<TabKey, number>>;
};

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "teams", label: "Teams", icon: "teams" },
  { key: "postfach", label: "Postfach", icon: "mail" },
  { key: "tasks", label: "Projekte", icon: "checklist" },
  { key: "kalender", label: "Kalender", icon: "calendar" },
];

export function BottomTabBar({ active, onNavigate, badges }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.divider} />
      <View style={styles.row}>
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const color = isActive ? colors.brandOrange : colors.textMutedLight;

          return (
            <Pressable
              key={tab.key}
              onPress={() => onNavigate?.(tab.key)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <View>
                <Icon name={tab.icon} size={26} color={color} />
                {(badges?.[tab.key] ?? 0) > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {(badges?.[tab.key] ?? 0) > 9 ? "9+" : badges?.[tab.key]}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
  row: {
    flexDirection: "row",
    paddingTop: 10,
    paddingBottom: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.priorityHighText,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    lineHeight: 12,
    color: "#FFFFFF",
  },
  label: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
  },
});
