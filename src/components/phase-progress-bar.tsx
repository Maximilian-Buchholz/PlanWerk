import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import type { Phase } from "@/types/tasks";

export type PhaseProgressBarProps = {
  phases: Phase[];
  currentPhaseId: string | null;
  isDone: boolean;
};

/**
 * The task counts as complete once it is done or has reached the final phase
 * ("Abschluss"); only then does the whole bar turn green.
 */
function isComplete(sorted: Phase[], currentIndex: number, isDone: boolean): boolean {
  if (isDone) return true;
  if (currentIndex < 0) return false;
  return sorted[currentIndex].name.trim().toLowerCase() === "abschluss" || currentIndex === sorted.length - 1;
}

export function PhaseProgressBar({ phases, currentPhaseId, isDone }: PhaseProgressBarProps) {
  const sorted = [...phases].sort((a, b) => a.position - b.position);
  const currentIndex = sorted.findIndex((phase) => phase.id === currentPhaseId);
  const complete = isComplete(sorted, currentIndex, isDone);

  return (
    <View
      style={styles.container}
      accessibilityLabel="Phasenfortschritt"
      accessibilityRole="progressbar"
    >
      <View style={styles.segmentsRow}>
        {sorted.map((phase, index) => {
          const isFilled = complete || (currentIndex >= 0 && index <= currentIndex);
          const color = complete ? colors.phaseDone : isFilled ? colors.phaseActive : colors.phaseUpcoming;

          return (
            <View
              key={phase.id}
              style={[styles.segment, { backgroundColor: color }, isFilled && styles.segmentFilled]}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Phase names, laid out in the same columns as the bar's segments. */
export function PhaseLabels({ phases, currentPhaseId, isDone }: PhaseProgressBarProps) {
  const sorted = [...phases].sort((a, b) => a.position - b.position);
  const currentIndex = sorted.findIndex((phase) => phase.id === currentPhaseId);
  const complete = isComplete(sorted, currentIndex, isDone);

  return (
    <View style={styles.labelsRow} accessibilityLabel="Phasen">
      {sorted.map((phase, index) => {
        const isFilled = complete || (currentIndex >= 0 && index <= currentIndex);
        const isCurrent = !isDone && index === currentIndex;

        return (
          <Text
            key={phase.id}
            style={[
              styles.label,
              isFilled && (complete ? styles.labelDone : styles.labelActive),
              isCurrent && styles.labelCurrent,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {phase.name}
          </Text>
        );
      })}
    </View>
  );
}

const SEGMENT_GAP = 4;

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  segmentsRow: {
    flexDirection: "row",
    gap: SEGMENT_GAP,
  },
  segment: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  segmentFilled: {
    opacity: 1,
  },
  labelsRow: {
    flexDirection: "row",
    gap: SEGMENT_GAP,
  },
  label: {
    flex: 1,
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    textAlign: "center",
    color: colors.textMutedLight,
  },
  labelActive: {
    color: colors.phaseActive,
  },
  labelDone: {
    color: colors.phaseDone,
  },
  labelCurrent: {
    fontFamily: "DMSans_600SemiBold",
  },
});
