import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "@/src/theme";
import { listHistory, deleteHistory, type HistoryItem } from "@/src/api";

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = React.useState<HistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listHistory();
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteHistory(id);
    } catch {
      load();
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} testID="history-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>History</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={28} color={colors.brandPrimary} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="folder-open-outline" size={30} color={colors.brandPrimary} />
          </View>
          <Text style={styles.emptyTitle}>No analyses yet</Text>
          <Text style={styles.emptySub}>Your saved scorecards will appear here.</Text>
          <Pressable onPress={() => router.replace("/")} style={styles.retryBtn} testID="empty-cta">
            <Text style={styles.retryText}>Analyse an argument</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.md,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brandPrimary}
            />
          }
          renderItem={({ item }) => <HistoryRow item={item} onDelete={onDelete} />}
        />
      )}
    </View>
  );
}

function HistoryRow({ item, onDelete }: { item: HistoryItem; onDelete: (id: string) => void }) {
  const router = useRouter();
  const higher = Math.max(item.person_a_score, item.person_b_score);
  const accent = higher >= 66 ? colors.brandPrimary : higher >= 33 ? colors.brandSecondary : colors.success;
  const date = new Date(item.created_at);
  const when = `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${date.toLocaleTimeString(
    undefined,
    { hour: "numeric", minute: "2-digit" },
  )}`;

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push({ pathname: "/scorecard", params: { id: item.id } })}
      testID={`history-item-${item.id}`}
    >
      <View style={styles.rowTop}>
        <View style={[styles.rowDot, { backgroundColor: accent }]} />
        <Text style={styles.rowNames} numberOfLines={1}>
          {item.person_a_name} <Text style={{ color: colors.muted }}>vs</Text> {item.person_b_name}
        </Text>
        <Pressable
          onPress={() => onDelete(item.id)}
          hitSlop={12}
          testID={`delete-${item.id}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.muted} />
        </Pressable>
      </View>
      <View style={styles.rowScores}>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreVal}>{item.person_a_score}</Text>
          <Text style={styles.scoreLbl}>{item.person_a_name}</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreVal, { color: accent }]}>{item.person_b_score}</Text>
          <Text style={styles.scoreLbl}>{item.person_b_name}</Text>
        </View>
      </View>
      <Text style={styles.rowVerdict} numberOfLines={2}>
        {item.verdict}
      </Text>
      <Text style={styles.rowDate}>{when}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { color: colors.onSurface, fontSize: 17, fontWeight: "500" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "500" },
  emptySub: { color: colors.muted, fontSize: 13, textAlign: "center" },
  errorText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  retryText: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "500" },
  row: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowDot: { width: 8, height: 8, borderRadius: 4 },
  rowNames: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "500",
  },
  rowScores: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  scoreBlock: { flex: 1 },
  scoreVal: {
    color: colors.onSurface,
    fontSize: 26,
    fontWeight: "500",
    letterSpacing: -0.8,
  },
  scoreLbl: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  scoreDivider: { width: 1, height: 30, backgroundColor: colors.border },
  rowVerdict: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  rowDate: { color: colors.muted, fontSize: 11 },
});
