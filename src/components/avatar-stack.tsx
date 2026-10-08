import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { colors } from "@/theme/colors";
import type { Profile } from "@/types/tasks";

export type AvatarStackProps = {
  profiles: Profile[];
  size?: number;
  max?: number;
};

export function AvatarStack({ profiles, size = 28, max = 4 }: AvatarStackProps) {
  const shown = profiles.slice(0, max);
  const overflow = profiles.length - shown.length;

  if (profiles.length === 0) {
    return null;
  }

  return (
    <View
      style={styles.row}
      accessibilityLabel={`Zugewiesen: ${profiles.map((p) => p.full_name ?? "Unbekannt").join(", ")}`}
    >
      {shown.map((profile, index) => (
        <Avatar
          key={profile.id}
          name={profile.full_name}
          color={profile.avatar_color}
          size={size}
          style={index > 0 && { marginLeft: -size * 0.35 }}
        />
      ))}
      {overflow > 0 && (
        <View
          style={[
            styles.overflow,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size * 0.35,
            },
          ]}
        >
          <Text style={[styles.overflowText, { fontSize: size * 0.34 }]}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  overflow: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.textMutedLight,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  overflowText: {
    fontFamily: "DMSans_600SemiBold",
    color: "#FFFFFF",
  },
});
