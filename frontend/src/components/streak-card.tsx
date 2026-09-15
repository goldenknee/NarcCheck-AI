import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing } from "@/src/theme";
import { useNoNarcStreak } from "@/src/lib/streak";

const DAY_LABEL = ["M", "T", "W", "T", "F", "S", "S"];

type Props = {
  enabled: boolean;
};

export function StreakCard({ enabled }: Props) {
  const {
    current,
    longest,
    freezesAvailable,
    weekPunches,
    loading,
    useFreeze,
  } = useNoNarcStreak(enabled);

  if (!enabled) return null;

  const hasFreezableWeek = weekPunches.some((w) => w.status === "narc");
  const canFreeze = enabled && freezesAvailable > 0 && hasFreezableWeek;

  const onFreeze = async () => {
    if (!canFreeze) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await useFreeze();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  return (
    <View style={styles.wrap} testID="streak-card">
      <View style={styles.row}>
        <View style={styles.flameWrap}>
          <Ionicons name="flame" size={22} color={colors.brandSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>No-Narc Streak</Text>
            <View style={styles.proTag}>
              <Text style={styles.proTagText}>PRO</Text>
            </View>
          </View>
          <Text style={styles.stat}>
            <Text style={styles.statNum} testID="streak-current">
              {current}
            </Text>
            <Text style={styles.statUnit}>
              {" "}
              week{current === 1 ? "" : "s"} · best {longest}
            </Text>
          </Text>
        </View>
      </View>

      <View style={styles.punchRow}>
        {weekPunches.map((w, i) => {
          const bg =
            w.status === "clean"
              ? colors.success
              : w.status === "narc"
              ? colors.brandPrimary
              : w.status === "frozen"
              ? colors.brandSecondary
              : colors.surfaceTertiary;
          const isLast = i === weekPunches.length - 1;
          return (
            <View key={w.weekStart} style={{ alignItems: "center", flex: 1, gap: 4 }}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: bg },
                  isLast && styles.dotActive,
                ]}
                testID={`streak-dot-${i}`}
              />
              <Text style={styles.dotLabel}>{isLast ? "now" : ""}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.freezeInfo}>
          <Ionicons name="snow" size={13} color={colors.info} />
          <Text style={styles.freezeText} testID="streak-freezes">
            {freezesAvailable} freeze{freezesAvailable === 1 ? "" : "s"} this month
          </Text>
        </View>
        {canFreeze ? (
          <Pressable onPress={onFreeze} style={styles.freezeBtn} testID="streak-use-freeze">
            {loading ? (
              <ActivityIndicator color={colors.onSurface} size="small" />
            ) : (
              <>
                <Ionicons name="snow" size={13} color={colors.onBrandPrimary} />
                <Text style={styles.freezeBtnText}>Freeze last week</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  flameWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "500",
  },
  proTag: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  proTagText: {
    color: colors.onBrandPrimary,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "500",
  },
  stat: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  statNum: {
    color: colors.brandSecondary,
    fontSize: 26,
    fontWeight: "500",
    letterSpacing: -0.5,
  },
  statUnit: {
    color: colors.muted,
    fontSize: 12,
  },
  punchRow: {
    flexDirection: "row",
    marginTop: spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotActive: {
    borderWidth: 2,
    borderColor: colors.onSurface,
  },
  dotLabel: {
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 1,
    minHeight: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  freezeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  freezeText: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  freezeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  freezeBtnText: {
    color: colors.onBrandPrimary,
    fontSize: 11,
    fontWeight: "500",
  },
});
