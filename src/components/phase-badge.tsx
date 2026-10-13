import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Palette } from "@/theme/colors";
import { useColors } from "@/theme/theme-context";

export function phaseBadgeColors(
  phaseName: string | null | undefined,
  colors: Palette,
): { text: string; bg: string } {
  const phaseStyles: Record<string, { text: string; bg: string }> = {
    briefing: { text: colors.phaseBriefingText, bg: colors.phaseBriefingBg },
    planung: { text: colors.phasePlanungText, bg: colors.phasePlanungBg },
    umsetzung: { text: colors.phaseUmsetzungText, bg: colors.phaseUmsetzungBg },
    review: { text: colors.phaseReviewText, bg: colors.phaseReviewBg },
    abschluss: { text: colors.phaseAbschlussText, bg: colors.phaseAbschlussBg },
  };
  const neutral = { text: colors.phaseNeutralText, bg: colors.phaseNeutralBg };
  if (!phaseName) return neutral;
  return phaseStyles[phaseName.trim().toLowerCase()] ?? neutral;
}

export type PhaseBadgeProps = {
  phaseName: string | null | undefined;
};

export function PhaseBadge({ phaseName }: PhaseBadgeProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { text, bg } = phaseBadgeColors(phaseName, colors);

  return (
    <View style={[styles.badge, { backgroundColor: bg }]} accessibilityLabel={`Phase: ${phaseName ?? "unbekannt"}`}>
      <Text style={[styles.text, { color: text }]} numberOfLines={1}>
        {(phaseName ?? "—").toUpperCase()}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    badge: {
      height: 22,
      borderRadius: 6,
      paddingHorizontal: 9,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
    },
    text: {
      fontFamily: "DMMono_500Medium",
      fontSize: 10,
      letterSpacing: 0.4,
    },
  });
