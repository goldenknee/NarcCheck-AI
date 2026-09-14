import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from "expo-audio";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing } from "@/src/theme";

type Props = {
  onTranscript: (text: string) => void;
};

function fmt(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

const MAX_SECONDS = 5 * 60; // Whisper allows up to 25MB, our cap 5 min

export function VoiceRecorder({ onTranscript }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useSharedValue(1);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      cancelAnimation(pulse);
    };
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  const start = async () => {
    setError(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError("Microphone permission is required.");
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setElapsed(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      pulse.value = withRepeat(withTiming(1.35, { duration: 900 }), -1, true);
      timer.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_SECONDS) {
            stop();
          }
          return next;
        });
      }, 1000);
    } catch (e: any) {
      setError(e?.message ?? "Failed to start recording");
    }
  };

  const stop = async () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    cancelAnimation(pulse);
    pulse.value = 1;
    try {
      await recorder.stop();
    } catch {}
    setIsRecording(false);
    const uri = recorder.uri;
    if (!uri) {
      setError("Recording produced no file");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    await upload(uri);
  };

  const cancel = async () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    cancelAnimation(pulse);
    pulse.value = 1;
    try {
      await recorder.stop();
    } catch {}
    setIsRecording(false);
    setElapsed(0);
  };

  const upload = async (uri: string) => {
    setTranscribing(true);
    try {
      const form = new FormData();
      // React Native FormData accepts { uri, name, type } for file uploads
      const name = uri.split("/").pop() || "voice.m4a";
      const ext = (name.split(".").pop() || "m4a").toLowerCase();
      const mime =
        ext === "wav" ? "audio/wav" :
        ext === "mp3" ? "audio/mpeg" :
        ext === "webm" ? "audio/webm" :
        "audio/m4a";
      // @ts-expect-error React Native's FormData file shape
      form.append("file", { uri, name, type: mime });

      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/transcribe`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.detail ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { text: string };
      onTranscript(data.text ?? "");
    } catch (e: any) {
      setError(e?.message ?? "Transcription failed");
    } finally {
      setTranscribing(false);
      setElapsed(0);
    }
  };

  if (Platform.OS === "web") {
    return (
      <View style={styles.webNote} testID="voice-web-unavailable">
        <Ionicons name="mic-off-outline" size={22} color={colors.muted} />
        <Text style={styles.webNoteTitle}>Voice recording is not available in the browser preview.</Text>
        <Text style={styles.webNoteBody}>
          Open the app in Expo Go on your phone (scan the QR code) to record a voice note.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="voice-recorder">
      <Text style={styles.help}>
        Record the argument as it happened. Say who's speaking each time (e.g. "Me: …", "Them: …") for the best result.
        Max 5 minutes.
      </Text>

      <View style={styles.stage}>
        <Animated.View style={[styles.pulse, pulseStyle, { pointerEvents: "none" }]} />
        <Pressable
          onPress={isRecording ? stop : start}
          disabled={transcribing}
          style={({ pressed }) => [
            styles.recBtn,
            isRecording && styles.recBtnActive,
            pressed && { opacity: 0.85 },
          ]}
          testID={isRecording ? "voice-stop" : "voice-record"}
        >
          {transcribing ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Ionicons
              name={isRecording ? "stop" : "mic"}
              size={40}
              color={colors.onBrandPrimary}
            />
          )}
        </Pressable>
      </View>

      <Text style={styles.timer} testID="voice-timer">
        {transcribing ? "Transcribing…" : fmt(elapsed)}
      </Text>
      <Text style={styles.hint}>
        {isRecording ? "Tap to stop and transcribe" : transcribing ? "Whisper is listening" : "Tap to start recording"}
      </Text>

      {isRecording ? (
        <Pressable onPress={cancel} style={styles.cancelBtn} testID="voice-cancel">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      ) : null}

      {error ? (
        <View style={styles.errorBox} testID="voice-error">
          <Ionicons name="alert-circle" size={14} color={colors.brandPrimary} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  help: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  stage: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.brandPrimary,
    opacity: 0.25,
  },
  recBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.surfaceSecondary,
  },
  recBtnActive: {
    backgroundColor: colors.brandTertiary,
    borderColor: colors.brandPrimary,
  },
  timer: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "500",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  cancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    marginTop: spacing.sm,
  },
  cancelText: { color: colors.onSurface, fontSize: 13, fontWeight: "500" },
  webNote: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  webNoteTitle: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    marginTop: spacing.sm,
  },
  webNoteBody: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    marginTop: spacing.sm,
  },
  errorText: { color: colors.onBrandTertiary, fontSize: 12, flex: 1 },
});
