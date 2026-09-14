import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing } from "@/src/theme";
import { analysisStore } from "@/src/analysis-store";
import type { AnalysisResult, HistoryItem } from "@/src/api";
import { getHistory, saveHistory } from "@/src/api";
import { DualGauge } from "@/src/components/dual-gauge";
import { TraitPill } from "@/src/components/trait-pill";
import { CollapsibleSection } from "@/src/components/collapsible-section";

export default function Scorecard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const historyId = typeof params.id === "string" ? params.id : undefined;

  const [remote, setRemote] = React.useState<HistoryItem | null>(null);
  const [loading, setLoading] = React.useState<boolean>(!!historyId);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveErr, setSaveErr] = useState<string | null>(null);

  React.useEffect(() => {
    if (!historyId) return;
    setLoading(true);
    getHistory(historyId)
      .then((item) => setRemote(item))
      .catch(() => setRemote(null))
      .finally(() => setLoading(false));
  }, [historyId]);

  const store = analysisStore.get();
  const result: AnalysisResult | null = remote ? remote.result : store.result;
  const nameA = remote ? remote.person_a_name : store.personAName;
  const nameB = remote ? remote.person_b_name : store.personBName;
  const isFromHistory = !!historyId;

  const winner = useMemo(() => {
    if (!result) return null;
    const a = result.person_a.narcissism_score;
    const b = result.person_b.narcissism_score;
    if (Math.abs(a - b) < 5) return { name: "Draw", tie: true };
    return a > b ? { name: nameA, tie: false } : { name: nameB, tie: false };
  }, [result, nameA, nameB]);

  const onSave = async () => {
    if (!result || saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    setSaveErr(null);
    try {
      const item = await saveHistory({
        person_a_name: nameA,
        person_b_name: nameB,
        result,
        source_mode: store.sourceMode,
        source_text_preview: store.sourceTextPreview,
      });
      analysisStore.set({ savedId: item.id });
      setSaveState("saved");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      setSaveState("error");
      setSaveErr(e?.message ?? "Failed to save");
    }
  };

  const onShare = async () => {
    if (!result) return;
    const msg =
      `Narc Scorecard\n` +
      `${nameA}: ${result.person_a.narcissism_score}/100\n` +
      `${nameB}: ${result.person_b.narcissism_score}/100\n\n` +
      `Verdict: ${result.verdict}`;
    try {
      await Share.share({ message: msg });
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={{ color: colors.muted }}>No analysis loaded.</Text>
        <Pressable onPress={() => router.replace("/")} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.brandPrimary }}>Back to home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#1a0505", colors.surface]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: 320 }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: 120 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={16} testID="back-btn">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Scorecard</Text>
          <Pressable onPress={onShare} hitSlop={16} testID="share-btn">
            <Ionicons name="share-outline" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        {/* Gauges */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <DualGauge
            valueA={result.person_a.narcissism_score}
            valueB={result.person_b.narcissism_score}
            nameA={nameA}
            nameB={nameB}
          />
        </View>

        {/* Verdict banner */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <View style={styles.verdictCard} testID="verdict-card">
            <View style={styles.verdictHeader}>
              <View style={styles.verdictIcon}>
                <Ionicons name="warning" size={16} color={colors.brandPrimary} />
              </View>
              <Text style={styles.verdictLabel}>
                {winner?.tie ? "TIE — MUTUAL DYNAMICS" : `LEADING: ${winner?.name?.toUpperCase()}`}
              </Text>
            </View>
            <Text style={styles.verdictText}>{result.verdict}</Text>
          </View>
        </View>

        {/* Traits per person */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md }}>
          <ParticipantTraitCard
            label="Person A"
            name={nameA}
            score={result.person_a.narcissism_score}
            traits={result.person_a.key_traits_detected}
          />
          <ParticipantTraitCard
            label="Person B"
            name={nameB}
            score={result.person_b.narcissism_score}
            traits={result.person_b.key_traits_detected}
          />
        </View>

        {/* Notable quotes */}
        {(result.person_a.notable_quotes.length + result.person_b.notable_quotes.length) > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <CollapsibleSection
              title="Notable Quotes"
              icon="chatbubbles"
              defaultOpen
              testID="quotes-section"
            >
              <View style={{ gap: spacing.md }}>
                {result.person_a.notable_quotes.map((q, i) => (
                  <QuoteRow key={`a-${i}`} who={nameA} text={q} />
                ))}
                {result.person_b.notable_quotes.map((q, i) => (
                  <QuoteRow key={`b-${i}`} who={nameB} text={q} />
                ))}
              </View>
            </CollapsibleSection>
          </View>
        ) : null}

        {/* Breakdown */}
        {result.breakdown ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <CollapsibleSection title="Chronological Breakdown" icon="pulse" testID="breakdown-section">
              <Text style={styles.breakdownText}>{result.breakdown}</Text>
            </CollapsibleSection>
          </View>
        ) : null}

        {saveErr ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <Text style={{ color: colors.brandPrimary, fontSize: 12 }}>{saveErr}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom action bar */}
      {!isFromHistory ? (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <Pressable
            onPress={onSave}
            disabled={saveState === "saving" || saveState === "saved"}
            style={[styles.secondaryBtn, saveState === "saved" && { opacity: 0.6 }]}
            testID="save-btn"
          >
            {saveState === "saving" ? (
              <ActivityIndicator color={colors.onSurface} />
            ) : (
              <Ionicons
                name={saveState === "saved" ? "checkmark-circle" : "bookmark-outline"}
                size={18}
                color={saveState === "saved" ? colors.success : colors.onSurface}
              />
            )}
            <Text style={styles.secondaryText}>
              {saveState === "saved" ? "Saved" : "Save to History"}
            </Text>
          </Pressable>
          <Pressable onPress={onShare} style={styles.primaryBtn} testID="share-cta">
            <Ionicons name="share-outline" size={18} color={colors.onBrandPrimary} />
            <Text style={styles.primaryText}>Share Card</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ParticipantTraitCard({
  label,
  name,
  score,
  traits,
}: {
  label: string;
  name: string;
  score: number;
  traits: string[];
}) {
  const accent = score >= 66 ? colors.brandPrimary : score >= 33 ? colors.brandSecondary : colors.success;
  return (
    <View style={styles.traitCard}>
      <View style={styles.traitHeader}>
        <View style={[styles.traitDot, { backgroundColor: accent }]} />
        <Text style={styles.traitLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.traitName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.traitScore, { color: accent }]}>{score}</Text>
      </View>
      {traits.length > 0 ? (
        <View style={styles.traitsRow}>
          {traits.map((t, i) => (
            <TraitPill key={i} label={t} testID={`trait-${label}-${i}`} />
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.muted, fontSize: 12 }}>No manipulative tactics detected.</Text>
      )}
    </View>
  );
}

function QuoteRow({ who, text }: { who: string; text: string }) {
  return (
    <View style={styles.quoteRow}>
      <View style={styles.quoteBar} />
      <View style={{ flex: 1 }}>
        <Text style={styles.quoteWho}>{who}</Text>
        <Text style={styles.quoteText}>&ldquo;{text}&rdquo;</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loadingRoot: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  headerTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.4,
  },
  verdictCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandPrimary,
  },
  verdictHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.sm,
  },
  verdictIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  verdictLabel: {
    color: colors.brandPrimary,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "500",
    flex: 1,
  },
  verdictText: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  traitCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  traitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.md,
  },
  traitDot: { width: 8, height: 8, borderRadius: 4 },
  traitLabel: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "500",
  },
  traitName: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 4,
    flex: 1,
  },
  traitScore: {
    fontSize: 20,
    fontWeight: "500",
    letterSpacing: -0.5,
  },
  traitsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quoteRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  quoteBar: {
    width: 2,
    backgroundColor: colors.brandPrimary,
    borderRadius: 1,
  },
  quoteWho: {
    color: colors.brandPrimary,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  quoteText: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  breakdownText: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: "rgba(9,9,11,0.9)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "500",
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  primaryText: {
    color: colors.onBrandPrimary,
    fontSize: 14,
    fontWeight: "500",
  },
});
