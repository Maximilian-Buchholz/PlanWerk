import { useEffect, useState, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { Spacing } from "@/constants/theme";
import { withAlpha, type Palette } from "@/theme/colors";
import { useColors } from "@/theme/theme-context";

const PADDING = 3;

export type SegmentedToggleOption<Key extends string> = {
  key: Key;
  label: string;
  accessibilityLabel?: string;
};

export type SegmentedToggleProps<Key extends string> = {
  options: SegmentedToggleOption<Key>[];
  value: Key;
  onChange: (key: Key) => void;
  /**
   * Optional external position (0 = first option, 1 = second, …). Pass one when other
   * elements should move in sync with the pill; otherwise the toggle animates on its own.
   */
  progress?: SharedValue<number>;
};

/** Segmented switch whose white pill slides between the options. */
export function SegmentedToggle<Key extends string>({
  options,
  value,
  onChange,
  progress,
}: SegmentedToggleProps<Key>) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ownProgress = useSharedValue(options.findIndex((option) => option.key === value));
  const position = progress ?? ownProgress;
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = Math.max(0, (trackWidth - PADDING * 2) / options.length);

  useEffect(() => {
    if (progress) return;
    ownProgress.value = withTiming(
      Math.max(0, options.findIndex((option) => option.key === value)),
      { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) },
    );
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * segmentWidth }],
  }));

  return (
    <View
      style={styles.track}
      accessibilityRole="tablist"
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.pill, { width: segmentWidth }, pillStyle]} />
      {options.map((option) => {
        const isActive = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={styles.option}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
          >
            <Text style={[styles.text, isActive && styles.textActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    track: {
      flexDirection: "row",
      backgroundColor: withAlpha(colors.ink, 0.06),
      borderRadius: 12,
      padding: PADDING,
      marginBottom: Spacing.three,
    },
    pill: {
      position: "absolute",
      top: PADDING,
      bottom: PADDING,
      left: PADDING,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    option: {
      flex: 1,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    text: {
      fontFamily: "DMSans_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
    textActive: {
      fontFamily: "DMSans_600SemiBold",
      color: colors.ink,
    },
  });
