import { Pressable, StyleSheet, Text, View } from "react-native";

import { AvatarStack } from "@/components/avatar-stack";
import { PhaseBadge, phaseBadgeColors } from "@/components/phase-badge";
import { Spacing } from "@/constants/theme";
import { colors } from "@/theme/colors";
import type { ProjectSummary } from "@/lib/tasks";

export type ProjectCardProps = {
  project: ProjectSummary;
  onPress?: (projectId: string) => void;
};

function CommentGlyph() {
  return <View style={styles.commentGlyph} />;
}

function formatDueDate(dueDate: string | null): { text: string; isOverdue: boolean } | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const text = due.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  return { text: `Bis ${text}`, isOverdue: due.getTime() < today.getTime() };
}

export function ProjectCard({ project, onPress }: ProjectCardProps) {
  const progress = project.totalTasks > 0 ? project.doneTasks / project.totalTasks : 0;
  const progressColor = phaseBadgeColors(project.currentPhase?.name).text;
  const dueDate = formatDueDate(project.dueDate);

  return (
    <Pressable
      onPress={() => onPress?.(project.id)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Projekt ${project.name} öffnen`}
    >
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={1}>
          {project.name}
        </Text>
        <PhaseBadge phaseName={project.currentPhase?.name} />
      </View>

      {dueDate && (
        <Text style={[styles.dueText, dueDate.isOverdue && styles.dueTextOverdue]}>{dueDate.text}</Text>
      )}

      <Text style={styles.progressLabel}>
        {project.doneTasks} von {project.totalTasks} Tasks erledigt
      </Text>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(progress * 100)}%`, backgroundColor: progressColor },
          ]}
        />
      </View>

      <View style={styles.footerRow}>
        <AvatarStack profiles={project.members} size={26} />
        <View style={styles.commentRow}>
          <CommentGlyph />
          <Text style={styles.commentText}>{project.openCommentsCount} offen</Text>
        </View>
      </View>
    </Pressable>
  );
}

const CARD_RADIUS = 15;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  name: {
    flex: 1,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 17,
    color: colors.ink,
  },
  dueText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  dueTextOverdue: {
    color: colors.priorityHighText,
  },
  progressLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  progressTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.phaseUpcoming,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2.5,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  commentGlyph: {
    width: 14,
    height: 11,
    borderWidth: 1.4,
    borderColor: colors.textMuted,
    borderRadius: 3,
    borderBottomRightRadius: 0,
  },
  commentText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: colors.textMuted,
  },
});
