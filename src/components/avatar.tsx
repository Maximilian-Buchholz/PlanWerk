import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { avatarColors } from "@/theme/colors";

/**
 * Safety net for profiles whose stored color predates the current palette
 * (e.g. the old orange): such colors are swapped for a stable palette color,
 * so the app never shows an off-palette avatar. The stored value is untouched;
 * supabase/avatar-colors.sql migrates it for good.
 */
function resolveAvatarColor(name: string | null, color: string): string {
  const normalized = color?.toUpperCase();
  const known = avatarColors.find((candidate) => candidate === normalized);
  if (known) return known;

  const seed = `${normalized}|${name ?? ""}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarColors[hash % avatarColors.length];
}

function getInitials(name: string | null): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export type PresenceStatus = "online" | "dnd" | "offline";

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: "#23A55A",
  dnd: "#F23F43",
  offline: "#80848E",
};

export type AvatarProps = {
  name: string | null;
  color: string;
  size?: number;
  shape?: "circle" | "square";
  /** When set, draws a Discord-style presence dot at the bottom-right corner. */
  status?: PresenceStatus;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ name, color, size = 28, shape = "circle", status, style }: AvatarProps) {
  return (
    <View
      accessibilityLabel={name ?? "Unbekannter Nutzer"}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: shape === "circle" ? size / 2 : size * 0.28,
          backgroundColor: resolveAvatarColor(name, color),
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{getInitials(name)}</Text>
      {status && (
        <View
          style={[
            styles.statusDot,
            {
              width: Math.max(10, size * 0.38),
              height: Math.max(10, size * 0.38),
              borderRadius: Math.max(10, size * 0.38) / 2,
              backgroundColor: STATUS_COLORS[status],
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  statusDot: {
    position: "absolute",
    right: -3,
    bottom: -3,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  initials: {
    fontFamily: "DMSans_600SemiBold",
    color: "#FFFFFF",
  },
});
