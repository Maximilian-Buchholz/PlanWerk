import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

const PHASE_STYLES: Record<string, { text: string; bg: string }> = {
  briefing: { text: colors.phaseBriefingText, bg: colors.phaseBriefingBg },
  planung: { text: colors.phasePlanungText, bg: colors.phasePlanungBg },
  umsetzung: { text: colors.phaseUmsetzungText, bg: colors.phaseUmsetzungBg },
  review: { text: colors.phaseReviewText, bg: colors.phaseReviewBg },
  abschluss: { text: colors.phaseAbschlussText, bg: colors.phaseAbschlussBg },
};

export function phaseBadgeColors(phaseName: string | null | undefined): { text: string; bg: string } {
  if (!phaseName) return { text: colors.phaseNeutralText, bg: colors.phaseNeutralBg };
  return PHASE_STYLES[phaseName.trim().toLowerCase()] ?? { text: colors.phaseNeutralText, bg: colors.phaseNeutralBg };
}

export type PhaseBadgeProps = {
  phaseName: string | null | undefined;
};

export function PhaseBadge({ phaseName }: PhaseBadgeProps) {
  const { text, bg } = phaseBadgeColors(phaseName);

  return (
    <View style={[styles.badge, { backgroundColor: bg }]} accessibilityLabel={`Phase: ${phaseName ?? "unbekannt"}`}>
      <Text style={[styles.text, { color: text }]} numberOfLines={1}>
        {(phaseName ?? "—").toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
