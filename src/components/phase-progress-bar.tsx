import { StyleSheet, View } from "react-native";

import { colors } from "@/theme/colors";
import type { Phase } from "@/types/tasks";

export type PhaseProgressBarProps = {
  phases: Phase[];
  currentPhaseId: string | null;
  isDone: boolean;
};

export function PhaseProgressBar({ phases, currentPhaseId, isDone }: PhaseProgressBarProps) {
  const sorted = [...phases].sort((a, b) => a.position - b.position);
  const currentIndex = sorted.findIndex((phase) => phase.id === currentPhaseId);

  return (
    <View
      style={styles.container}
      accessibilityLabel="Phasenfortschritt"
      accessibilityRole="progressbar"
    >
      <View style={styles.segmentsRow}>
        {sorted.map((phase, index) => {
          const isPast = isDone || (currentIndex >= 0 && index < currentIndex);
          const isCurrent = !isDone && index === currentIndex;
          const isFilled = isPast || isCurrent;
          const color = isDone || isPast ? colors.phaseDone : isCurrent ? colors.phaseActive : colors.phaseUpcoming;

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
});
