import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { AvatarStack } from "@/components/avatar-stack";
import { formatDueDate } from "@/components/task-card";
import { Spacing } from "@/constants/theme";
import { withAlpha, type Palette } from "@/theme/colors";
import { useColors } from "@/theme/theme-context";
import type { Phase, TaskWithRelations } from "@/types/tasks";

const BOARD_PADDING = 18;
const COLUMN_GAP = 12;
/** Distance from the screen edge at which dragging a card scrolls the board. */
const EDGE_SCROLL_ZONE = 56;
const EDGE_SCROLL_SPEED = 10;
const CARD_RADIUS = 12;
const COLUMN_RADIUS = 15;

export type KanbanBoardProps = {
  phases: Phase[];
  tasks: TaskWithRelations[];
  onMoveTask: (taskId: string, phaseId: string) => void;
  onEditTask?: (taskId: string) => void;
};

/** Shared drag state, handed to every card so its gesture can drive the ghost card and column highlight. */
type DragContext = {
  dragging: SharedValue<boolean>;
  fingerX: SharedValue<number>;
  fingerY: SharedValue<number>;
  updateHover: () => void;
  onStart: (taskId: string) => void;
  onDrop: (taskId: string) => void;
  onFinish: () => void;
};

/**
 * Kanban view of a project: one column per phase. Drag a card by its grip handle
 * onto another column and release to move the task into that phase. Dragging
 * near the left/right edge scrolls the board.
 */
export function KanbanBoard({ phases, tasks, onMoveTask, onEditTask }: KanbanBoardProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const columnWidth = Math.min(300, windowWidth * 0.74);
  const columnStride = columnWidth + COLUMN_GAP;
  const sortedPhases = useMemo(() => [...phases].sort((a, b) => a.position - b.position), [phases]);
  const phaseCount = sortedPhases.length;
  const contentWidth =
    BOARD_PADDING * 2 + phaseCount * columnWidth + Math.max(0, phaseCount - 1) * COLUMN_GAP;

  const rootRef = useRef<View>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const viewWidth = useSharedValue(windowWidth);
  const viewHeight = useSharedValue(0);
  const dragging = useSharedValue(false);
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  /** Index of the column under the finger, or -1 when it is outside the board. */
  const hoverIndex = useSharedValue(-1);

  const [boardHeight, setBoardHeight] = useState(0);
  const [dragTask, setDragTask] = useState<TaskWithRelations | null>(null);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  function measureRoot() {
    rootRef.current?.measureInWindow((x, y, width, height) => {
      originX.value = x;
      originY.value = y;
      viewWidth.value = width;
      viewHeight.value = height;
    });
  }

  const updateHover = () => {
    "worklet";
    const relativeY = fingerY.value - originY.value;
    if (relativeY < 0 || relativeY > viewHeight.value) {
      hoverIndex.value = -1;
      return;
    }
    const relativeX = fingerX.value - originX.value + scrollX.value - BOARD_PADDING;
    const index = Math.floor(relativeX / columnStride);
    hoverIndex.value = Math.min(phaseCount - 1, Math.max(0, index));
  };

  // While a card is held near the edge, keep scrolling the board sideways.
  useFrameCallback(() => {
    if (!dragging.value) return;
    const relativeX = fingerX.value - originX.value;
    let next = scrollX.value;
    if (relativeX < EDGE_SCROLL_ZONE) next -= EDGE_SCROLL_SPEED;
    else if (relativeX > viewWidth.value - EDGE_SCROLL_ZONE) next += EDGE_SCROLL_SPEED;

    next = Math.min(Math.max(0, contentWidth - viewWidth.value), Math.max(0, next));
    if (next !== scrollX.value) {
      scrollTo(scrollRef, next, 0, false);
      scrollX.value = next;
    }
    updateHover();
  });

  // Gestures keep calling the callbacks they were built with, so route them through a ref
  // that always points at the latest data instead of rebuilding the gestures mid-drag.
  const latest = useRef({ tasks, sortedPhases, onMoveTask });
  latest.current = { tasks, sortedPhases, onMoveTask };

  const dragContext = useMemo<DragContext>(
    () => ({
      dragging,
      fingerX,
      fingerY,
      updateHover,
      onStart: (taskId) => {
        measureRoot();
        setDragTask(latest.current.tasks.find((candidate) => candidate.id === taskId) ?? null);
      },
      onDrop: (taskId) => {
        const index = hoverIndex.value;
        const { tasks: currentTasks, sortedPhases: currentPhases, onMoveTask: move } = latest.current;
        const phase = index >= 0 ? currentPhases[index] : undefined;
        const task = currentTasks.find((candidate) => candidate.id === taskId);
        if (phase && task && task.phase_id !== phase.id) move(taskId, phase.id);
      },
      onFinish: () => {
        hoverIndex.value = -1;
        setDragTask(null);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phaseCount, columnStride],
  );

  const cardWidth = columnWidth - Spacing.two * 2;
  const ghostStyle = useAnimatedStyle(() => ({
    opacity: dragging.value ? 1 : 0,
    transform: [
      { translateX: fingerX.value - originX.value - cardWidth / 2 },
      { translateY: fingerY.value - originY.value - 28 },
      { rotate: "3deg" },
      { scale: 1.03 },
    ],
  }));

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={styles.root}
      onLayout={(event) => {
        setBoardHeight(event.nativeEvent.layout.height);
        measureRoot();
      }}
    >
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={columnStride}
        contentContainerStyle={styles.boardContent}
      >
        {sortedPhases.map((phase, index) => (
          <Column
            key={phase.id}
            index={index}
            phase={phase}
            width={columnWidth}
            height={Math.max(0, boardHeight - Spacing.two)}
            hoverIndex={hoverIndex}
            tasks={tasks.filter(
              (task) =>
                task.phase_id === phase.id ||
                // Tasks without a (known) phase land in the first column.
                (index === 0 && !sortedPhases.some((candidate) => candidate.id === task.phase_id)),
            )}
            draggedTaskId={dragTask?.id ?? null}
            dragContext={dragContext}
            onEditTask={onEditTask}
          />
        ))}
      </Animated.ScrollView>

      {dragTask && (
        <Animated.View pointerEvents="none" style={[styles.ghost, { width: cardWidth }, ghostStyle]}>
          <CardContent task={dragTask} />
        </Animated.View>
      )}
    </View>
  );
}

function Column({
  index,
  phase,
  width,
  height,
  hoverIndex,
  tasks,
  draggedTaskId,
  dragContext,
  onEditTask,
}: {
  index: number;
  phase: Phase;
  width: number;
  height: number;
  hoverIndex: SharedValue<number>;
  tasks: TaskWithRelations[];
  draggedTaskId: string | null;
  dragContext: DragContext;
  onEditTask?: (taskId: string) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // The column under the dragged card gets an orange outline.
  const highlight = useAnimatedStyle(() => ({
    borderColor: hoverIndex.value === index ? colors.brandOrange : "transparent",
  }));

  return (
    <Animated.View style={[styles.column, { width, height }, highlight]}>
      <View style={styles.columnHeader}>
        <Text style={styles.columnTitle} numberOfLines={1}>
          {phase.name.toUpperCase()}
        </Text>
        <Text style={styles.columnCount}>{tasks.length}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.columnCards}
      >
        {tasks.length === 0 && <Text style={styles.emptyColumn}>Keine Tasks</Text>}
        {tasks.map((task) => (
          <BoardCard
            key={task.id}
            task={task}
            isDragged={task.id === draggedTaskId}
            dragContext={dragContext}
            onPress={() => onEditTask?.(task.id)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function BoardCard({
  task,
  isDragged,
  dragContext,
  onPress,
}: {
  task: TaskWithRelations;
  isDragged: boolean;
  dragContext: DragContext;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { dragging, fingerX, fingerY, onStart, onDrop, onFinish } = dragContext;

  const taskId = task.id;
  // A PanResponder claims the touch the moment the handle is pressed. React Native then keeps the
  // surrounding ScrollViews from taking it over (the problem with the gesture-handler version, where
  // the scroll won and the drag was cancelled right away). The column under the finger is worked
  // out every frame by the board's frame callback, so only the finger position is written here.
  const panResponder = useMemo(() => {
    const finish = () => {
      dragging.value = false;
      onFinish();
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        fingerX.value = event.nativeEvent.pageX;
        fingerY.value = event.nativeEvent.pageY;
        dragging.value = true;
        onStart(taskId);
      },
      onPanResponderMove: (_event, gesture) => {
        fingerX.value = gesture.moveX;
        fingerY.value = gesture.moveY;
      },
      onPanResponderRelease: () => {
        onDrop(taskId);
        finish();
      },
      onPanResponderTerminate: finish,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, dragContext]);

  return (
    <View style={[styles.card, styles.cardRow, isDragged && styles.cardDragged]}>
      <Pressable
        onPress={onPress}
        style={styles.cardBody}
        accessibilityRole="button"
        accessibilityLabel={`Task bearbeiten: ${task.title}`}
      >
        <CardContent task={task} />
      </Pressable>
      <View
        {...panResponder.panHandlers}
        collapsable={false}
        style={styles.handle}
        accessible
        accessibilityLabel="Task verschieben"
        accessibilityHint="Ziehen, um den Task in eine andere Phase zu verschieben"
      >
        <View style={styles.handleDots}>
          {Array.from({ length: 6 }, (_, dot) => (
            <View key={dot} style={styles.handleDot} />
          ))}
        </View>
      </View>
    </View>
  );
}

function CardContent({ task }: { task: TaskWithRelations }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const due = formatDueDate(task.due_date);

  return (
    <View style={styles.cardInner}>
      <Text style={[styles.cardTitle, task.is_done && styles.cardTitleDone]} numberOfLines={3}>
        {task.title}
      </Text>
      {due && (
        <Text style={[styles.cardDue, due.isUrgent && !task.is_done && styles.cardDueUrgent]} numberOfLines={1}>
          {due.text}
        </Text>
      )}
      {task.assignees.length > 0 && (
        <View style={styles.cardFooter}>
          <AvatarStack profiles={task.assignees} size={22} />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    boardContent: {
      paddingHorizontal: BOARD_PADDING,
      paddingTop: Spacing.one,
      gap: COLUMN_GAP,
    },
    column: {
      backgroundColor: withAlpha(colors.ink, 0.05),
      borderRadius: COLUMN_RADIUS,
      borderWidth: 2,
      borderColor: "transparent",
      padding: Spacing.two,
    },
    columnHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.one,
      paddingBottom: Spacing.two,
    },
    columnTitle: {
      flex: 1,
      fontFamily: "DMMono_500Medium",
      fontSize: 11,
      letterSpacing: 0.5,
      color: colors.textMuted,
    },
    columnCount: {
      fontFamily: "DMMono_500Medium",
      fontSize: 11,
      color: colors.textMutedLight,
    },
    columnCards: {
      gap: Spacing.two,
      paddingBottom: 90,
    },
    emptyColumn: {
      fontFamily: "DMSans_400Regular",
      fontSize: 13,
      color: colors.textMutedLight,
      textAlign: "center",
      paddingVertical: Spacing.three,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: CARD_RADIUS,
      paddingVertical: Spacing.three,
      paddingLeft: Spacing.three,
      paddingRight: Spacing.three,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    cardBody: {
      flex: 1,
    },
    handle: {
      width: 32,
      height: 32,
      marginRight: -Spacing.two,
      marginTop: -Spacing.one,
      alignItems: "center",
      justifyContent: "center",
    },
    handleDots: {
      width: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 2,
    },
    handleDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMutedLight,
    },
    cardDragged: {
      opacity: 0.35,
    },
    cardInner: {
      gap: Spacing.one,
    },
    cardTitle: {
      fontFamily: "DMSans_500Medium",
      fontSize: 14,
      color: colors.ink,
    },
    cardTitleDone: {
      color: colors.textMutedLight,
      textDecorationLine: "line-through",
    },
    cardDue: {
      fontFamily: "DMSans_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
    cardDueUrgent: {
      color: colors.priorityHighText,
    },
    cardFooter: {
      flexDirection: "row",
      marginTop: Spacing.one,
    },
    ghost: {
      position: "absolute",
      top: 0,
      left: 0,
      backgroundColor: colors.surface,
      borderRadius: CARD_RADIUS,
      padding: Spacing.three,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
      elevation: 10,
    },
  });
