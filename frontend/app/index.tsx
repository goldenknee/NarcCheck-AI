import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing } from "@/src/theme";
import { analysisStore } from "@/src/analysis-store";

type Mode = "text" | "image";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("text");
  const [transcript, setTranscript] = useState("");
  const [personA, setPersonA] = useState("");
  const [personB, setPersonB] = useState("");
  const [images, setImages] = useState<{ uri: string; base64: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImages = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Photo library permission is required.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 6,
        base64: true,
        quality: 0.7,
      });
      if (res.canceled) return;
      const picked = res.assets
        .filter((a) => !!a.base64)
        .map((a) => ({ uri: a.uri, base64: a.base64 as string }));
      setImages((prev) => [...prev, ...picked].slice(0, 6));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (e: any) {
      setError(e?.message ?? "Failed to pick images");
    }
  }, []);

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const canAnalyze =
    (mode === "text" && transcript.trim().length > 10) ||
    (mode === "image" && images.length > 0);

  const analyzeNow = async () => {
    if (!canAnalyze || loading) return;
    setError(null);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const nameA = personA.trim() || "Person A";
    const nameB = personB.trim() || "Person B";

    try {
      const body =
        mode === "text"
          ? { mode, text: transcript.trim(), person_a_name: nameA, person_b_name: nameB }
          : { mode, images_base64: images.map((i) => i.base64), person_a_name: nameA, person_b_name: nameB };

      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.detail ?? `HTTP ${res.status}`);
      }
      const result = await res.json();
      analysisStore.set({
        result,
        personAName: nameA,
        personBName: nameB,
        sourceMode: mode,
        sourceTextPreview: mode === "text" ? transcript.trim().slice(0, 240) : `${images.length} screenshot(s)`,
        savedId: null,
      });
      router.push("/scorecard");
    } catch (e: any) {
      setError(e?.message ?? "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.surface, "#1a0505", colors.surface]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + spacing.xl,
            paddingHorizontal: spacing.lg,
            paddingBottom: 140 + insets.bottom,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.badge} testID="app-badge">
              <Ionicons name="warning" size={13} color={colors.brandPrimary} />
              <Text style={styles.badgeText}>FORENSIC ANALYSIS</Text>
            </View>
            <Pressable
              hitSlop={16}
              onPress={() => router.push("/history")}
              testID="history-nav-button"
            >
              <Ionicons name="time-outline" size={22} color={colors.onSurface} />
            </Pressable>
          </View>

          <Text style={styles.title} testID="home-title">
            Narc
          </Text>
          <Text style={styles.subtitle}>
            Analyse an argument. Uncover manipulation tactics. Score the narcissism.
          </Text>

          {/* Mode switcher */}
          <View style={styles.segment} testID="mode-segment">
            <Pressable
              onPress={() => setMode("text")}
              style={[styles.segmentBtn, mode === "text" && styles.segmentBtnActive]}
              testID="mode-text"
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color={mode === "text" ? colors.onBrandPrimary : colors.muted}
              />
              <Text style={[styles.segmentText, mode === "text" && styles.segmentTextActive]}>
                Paste Transcript
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("image")}
              style={[styles.segmentBtn, mode === "image" && styles.segmentBtnActive]}
              testID="mode-image"
            >
              <Ionicons
                name="images-outline"
                size={16}
                color={mode === "image" ? colors.onBrandPrimary : colors.muted}
              />
              <Text style={[styles.segmentText, mode === "image" && styles.segmentTextActive]}>
                Upload Screenshots
              </Text>
            </Pressable>
          </View>

          {/* Participant names */}
          <View style={styles.namesRow}>
            <View style={styles.nameField}>
              <Text style={styles.nameLabel}>Person A (you)</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="You"
                placeholderTextColor={colors.muted}
                value={personA}
                onChangeText={setPersonA}
                testID="input-person-a"
              />
            </View>
            <View style={styles.nameField}>
              <Text style={styles.nameLabel}>Person B</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="Them"
                placeholderTextColor={colors.muted}
                value={personB}
                onChangeText={setPersonB}
                testID="input-person-b"
              />
            </View>
          </View>

          {/* Input area */}
          {mode === "text" ? (
            <View style={styles.textCard}>
              <Text style={styles.helpText}>
                Paste the raw conversation. Prefix each line with the sender's name (e.g., "You: ..." / "Them: ...") for best accuracy.
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder={"You: Why are you like this?\nThem: Wow. Here you go again..."}
                placeholderTextColor={colors.muted}
                value={transcript}
                onChangeText={setTranscript}
                multiline
                textAlignVertical="top"
                testID="input-transcript"
              />
              <Text style={styles.charCount}>{transcript.length} chars</Text>
            </View>
          ) : (
            <View style={styles.uploadCard}>
              <Pressable style={styles.uploadZone} onPress={pickImages} testID="upload-btn">
                <View style={styles.uploadIcon}>
                  <Ionicons name="cloud-upload-outline" size={26} color={colors.brandPrimary} />
                </View>
                <Text style={styles.uploadTitle}>Tap to select screenshots</Text>
                <Text style={styles.uploadSub}>Up to 6 images · JPEG / PNG</Text>
              </Pressable>
              {images.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbRow}
                >
                  {images.map((img, i) => (
                    <View key={i} style={styles.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.thumb} />
                      <Pressable
                        onPress={() => removeImage(i)}
                        style={styles.thumbRemove}
                        hitSlop={8}
                        testID={`remove-image-${i}`}
                      >
                        <Ionicons name="close" size={12} color={colors.onBrandPrimary} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          )}

          {error ? (
            <View style={styles.errorBox} testID="error-banner">
              <Ionicons name="alert-circle" size={16} color={colors.brandPrimary} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Sticky CTA */}
        <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <Pressable
            onPress={analyzeNow}
            disabled={!canAnalyze || loading}
            style={({ pressed }) => [
              styles.cta,
              (!canAnalyze || loading) && styles.ctaDisabled,
              pressed && { opacity: 0.85 },
            ]}
            testID="analyze-button"
          >
            {loading ? (
              <>
                <ActivityIndicator color={colors.onBrandPrimary} />
                <Text style={styles.ctaText}>Analysing…</Text>
              </>
            ) : (
              <>
                <Ionicons name="speedometer" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.ctaText}>Analyse Argument</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.brandTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandPrimary,
  },
  badgeText: {
    color: colors.onBrandTertiary,
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.onSurface,
    fontSize: 44,
    fontWeight: "500",
    letterSpacing: -1.5,
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    maxWidth: 320,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
    marginBottom: spacing.lg,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm + 2,
  },
  segmentBtnActive: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  segmentTextActive: { color: colors.onBrandPrimary },
  namesRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  nameField: { flex: 1 },
  nameLabel: {
    color: colors.muted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  nameInput: {
    backgroundColor: colors.surfaceSecondary,
    color: colors.onSurface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  textCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  helpText: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  textArea: {
    minHeight: 220,
    color: colors.onSurface,
    fontSize: 15,
    lineHeight: 22,
  },
  charCount: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "right",
    marginTop: 6,
  },
  uploadCard: {
    gap: spacing.md,
  },
  uploadZone: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    paddingVertical: 36,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  uploadTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "500" },
  uploadSub: { color: colors.muted, fontSize: 12, marginTop: 4 },
  thumbRow: { gap: spacing.sm, paddingRight: spacing.lg },
  thumbWrap: { position: "relative" },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
  },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: colors.brandPrimary,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandPrimary,
  },
  errorText: { color: colors.onBrandTertiary, fontSize: 13, flex: 1 },
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: "rgba(9,9,11,0.9)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 16,
  },
  ctaDisabled: { backgroundColor: colors.surfaceTertiary },
  ctaText: {
    color: colors.onBrandPrimary,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});
