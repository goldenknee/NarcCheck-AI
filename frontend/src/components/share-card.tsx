import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import type { AnalysisResult } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

type Props = {
  result: AnalysisResult;
  nameA: string;
  nameB: string;
};

const CARD_WIDTH = 720;
const CARD_HEIGHT = 900;

function scoreColor(v: number) {
  if (v >= 66) return colors.brandPrimary;
  if (v >= 33) return colors.brandSecondary;
  return colors.success;
}

/**
 * A branded scorecard rendered off-screen at a fixed size for capture with
 * react-native-view-shot. Kept visually simple — dual scores, VS, top traits, brand line.
 */
export const ShareCard = forwardRef<View, Props>(function ShareCard({ result, nameA, nameB }, ref) {
  const a = result.person_a;
  const b = result.person_b;
  const traits = Array.from(new Set([...a.key_traits_detected, ...b.key_traits_detected])).slice(0, 5);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={styles.card}
      pointerEvents="none"
    >
      <LinearGradient
        colors={["#2a0808", "#09090B", "#09090B"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandBadge}>
          <Ionicons name="warning" size={16} color={colors.brandPrimary} />
          <Text style={styles.brandBadgeText}>NARCCHECK AI</Text>
        </View>
        <Text style={styles.headerHint}>FORENSIC SCORECARD</Text>
      </View>

      {/* Scores row */}
      <View style={styles.scoresRow}>
        <ScoreBlock name={nameA} score={a.narcissism_score} align="left" />
        <View style={styles.vsWrap}>
          <Text style={styles.vsText}>VS</Text>
          <View style={styles.vsBar} />
        </View>
        <ScoreBlock name={nameB} score={b.narcissism_score} align="right" />
      </View>

      {/* Verdict */}
      <View style={styles.verdictBox}>
        <Ionicons name="flame" size={16} color={colors.brandPrimary} style={{ marginRight: 8 }} />
        <Text style={styles.verdictText} numberOfLines={4}>
          {result.verdict}
        </Text>
      </View>

      {/* Traits */}
      {traits.length > 0 ? (
        <View style={styles.traitsSection}>
          <Text style={styles.sectionLabel}>DETECTED TACTICS</Text>
          <View style={styles.traitsWrap}>
            {traits.map((t) => (
              <View key={t} style={styles.traitPill}>
                <View style={styles.traitDot} />
                <Text style={styles.traitText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>NARCCHECK AI</Text>
        <Text style={styles.footerCta}>Score your own argument →</Text>
      </View>
    </View>
  );
});

function ScoreBlock({
  name,
  score,
  align,
}: {
  name: string;
  score: number;
  align: "left" | "right";
}) {
  const c = scoreColor(score);
  return (
    <View style={[styles.scoreBlock, { alignItems: align === "left" ? "flex-start" : "flex-end" }]}>
      <Text style={styles.scoreName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.scoreValue, { color: c }]}>{score}</Text>
      <Text style={styles.scoreUnit}>/ 100</Text>
      <View style={[styles.scoreDash, { backgroundColor: c }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.surface,
    padding: 48,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 48,
  },
  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandPrimary,
  },
  brandBadgeText: {
    color: colors.onBrandTertiary,
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 2,
  },
  headerHint: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 2,
  },
  scoresRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 40,
    gap: 24,
  },
  scoreBlock: {
    flex: 1,
    justifyContent: "center",
  },
  scoreName: {
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: -0.3,
    marginBottom: 8,
    maxWidth: 220,
  },
  scoreValue: {
    fontSize: 108,
    fontWeight: "500",
    letterSpacing: -4,
    lineHeight: 116,
  },
  scoreUnit: {
    color: colors.muted,
    fontSize: 14,
    letterSpacing: 1,
    marginTop: 4,
  },
  scoreDash: {
    marginTop: 12,
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  vsWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
  },
  vsText: {
    color: colors.muted,
    fontSize: 20,
    fontWeight: "500",
    letterSpacing: 4,
    marginBottom: 8,
  },
  vsBar: {
    width: 1,
    height: 100,
    backgroundColor: colors.borderStrong,
  },
  verdictBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    padding: 24,
    marginBottom: 32,
  },
  verdictText: {
    flex: 1,
    color: colors.onSurfaceSecondary,
    fontSize: 18,
    lineHeight: 27,
    fontStyle: "italic",
  },
  traitsSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 2.4,
    fontWeight: "500",
    marginBottom: 16,
  },
  traitsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  traitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandPrimary,
  },
  traitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brandPrimary,
  },
  traitText: {
    color: colors.onBrandTertiary,
    fontSize: 16,
    fontWeight: "500",
  },
  footer: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBrand: {
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: "500",
    letterSpacing: 3,
  },
  footerCta: {
    color: colors.brandPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
});
