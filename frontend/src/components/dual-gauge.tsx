import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing } from "@/src/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type GaugeProps = {
  value: number; // 0-100
  label: string;
  sublabel?: string;
  testID?: string;
  onSettle?: () => void;
  delay?: number;
};

const SIZE = 148;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

// Sweep only the top half (270°) so it reads as a gauge.
const SWEEP = 0.75;
const ROTATE = -225; // start bottom-left

function scoreColor(v: number): string {
  if (v >= 66) return colors.brandPrimary; // red
  if (v >= 33) return colors.brandSecondary; // amber
  return colors.success;
}

function Gauge({ value, label, sublabel, testID, onSettle, delay = 0 }: GaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const progress = useSharedValue(0);
  const displayed = useSharedValue(0);
  const [displayNumber, setDisplayNumber] = React.useState(0);
  const target = scoreColor(clamped);

  useEffect(() => {
    progress.value = 0;
    displayed.value = 0;
    const t = setTimeout(() => {
      progress.value = withTiming(clamped / 100, {
        duration: 1400,
        easing: Easing.out(Easing.cubic),
      });
      displayed.value = withTiming(
        clamped,
        { duration: 1400, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished && onSettle) runOnJS(onSettle)();
        },
      );
    }, delay);
    return () => clearTimeout(t);
  }, [clamped, delay]);

  useAnimatedReaction(
    () => Math.round(displayed.value),
    (curr, prev) => {
      if (curr !== prev) runOnJS(setDisplayNumber)(curr);
    },
    [],
  );

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: C * SWEEP * (1 - progress.value),
  }));

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={target} stopOpacity="1" />
              <Stop offset="100%" stopColor={target} stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          {/* Track */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={colors.surfaceTertiary}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${C * SWEEP} ${C}`}
            strokeLinecap="round"
            rotation={ROTATE}
            originX={SIZE / 2}
            originY={SIZE / 2}
          />
          {/* Progress */}
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="url(#grad)"
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${C * SWEEP} ${C}`}
            strokeLinecap="round"
            rotation={ROTATE}
            originX={SIZE / 2}
            originY={SIZE / 2}
            animatedProps={animatedProps}
          />
        </Svg>
        <View style={[styles.center, { pointerEvents: "none" }]}>
          <Text style={[styles.score, { color: target }]} testID={`${testID}-value`}>
            {displayNumber}
          </Text>
          <Text style={styles.scoreOutOf}>/ 100</Text>
        </View>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </View>
  );
}

type DualProps = {
  valueA: number;
  valueB: number;
  nameA: string;
  nameB: string;
};

export function DualGauge({ valueA, valueB, nameA, nameB }: DualProps) {
  const onSettle = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, []);

  return (
    <View style={styles.row}>
      <Gauge
        value={valueA}
        label={nameA}
        sublabel="Person A"
        testID="gauge-a"
        delay={100}
        onSettle={onSettle}
      />
      <View style={styles.vs}>
        <Text style={styles.vsText}>VS</Text>
      </View>
      <Gauge value={valueB} label={nameB} sublabel="Person B" testID="gauge-b" delay={350} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  wrap: {
    alignItems: "center",
    flex: 1,
  },
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontSize: 40,
    fontWeight: "500",
    letterSpacing: -1,
  },
  scoreOutOf: {
    color: colors.muted,
    fontSize: 11,
    marginTop: -2,
  },
  label: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "500",
    marginTop: spacing.md,
    maxWidth: 130,
    textAlign: "center",
  },
  sublabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  vs: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  vsText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
  },
});
