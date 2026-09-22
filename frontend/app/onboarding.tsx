import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing } from "@/src/theme";
import { useOnboardingState } from "@/src/lib/onboarding";

type Slide = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent: string;
};

const SLIDES: Slide[] = [
  {
    key: "analyse",
    eyebrow: "FORENSIC ANALYSIS",
    title: "See through\nthe argument.",
    body: "Paste a transcript, upload screenshots, or record a voice note. NarcCheck AI scores each person's manipulation tactics and hands you a receipts-ready verdict.",
    icon: "speedometer",
    accent: colors.brandPrimary,
  },
  {
    key: "pro",
    eyebrow: "NARC PRO",
    title: "3 free.\nThen unlimited.",
    body: "You get 3 free analyses to try it. Unlock unlimited scoring plus the No-Narc Streak with a Monthly or Annual plan — cancel anytime.",
    icon: "flash",
    accent: colors.brandSecondary,
  },
  {
    key: "sync",
    eyebrow: "OPTIONAL SIGN-IN",
    title: "Sync every\nreceipt across devices.",
    body: "Sign in with Apple or Google to keep your history and Pro plan across every device. Prefer to stay anonymous? The app works without an account too.",
    icon: "cloud-upload",
    accent: colors.info,
  },
];

const { width } = Dimensions.get("window");

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { complete } = useOnboardingState();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) {
      setIndex(i);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const goNext = async () => {
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await complete();
      router.replace("/");
    }
  };

  const finish = async () => {
    await complete();
    router.replace("/");
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#2a0808", "#09090B"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 520 }}
      />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.badge}>
          <Ionicons name="warning" size={12} color={colors.brandPrimary} />
          <Text style={styles.badgeText}>NARCCHECK AI</Text>
        </View>
        {index < SLIDES.length - 1 ? (
          <Pressable onPress={finish} hitSlop={12} testID="onboarding-skip">
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        testID="onboarding-scroll"
      >
        {SLIDES.map((s) => (
          <SlideView key={s.key} slide={s} width={width} />
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        <Pressable
          onPress={goNext}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          testID="onboarding-next"
        >
          <Text style={styles.ctaText}>
            {index < SLIDES.length - 1 ? "Continue" : "Analyse an argument"}
          </Text>
          <Ionicons
            name={index < SLIDES.length - 1 ? "arrow-forward" : "flash"}
            size={18}
            color={colors.onBrandPrimary}
          />
        </Pressable>
      </View>
    </View>
  );
}

function SlideView({ slide, width }: { slide: Slide; width: number }) {
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.15, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.visual}>
        <Animated.View style={[styles.halo, { backgroundColor: slide.accent }, pulseStyle, { pointerEvents: "none" }]} />
        <View style={[styles.iconWrap, { borderColor: slide.accent }]}>
          <Ionicons name={slide.icon} size={54} color={slide.accent} />
        </View>
      </View>

      <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandPrimary,
  },
  badgeText: {
    color: colors.onBrandTertiary,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "500",
  },
  skipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.4,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 140,
    paddingBottom: 200,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  visual: {
    height: 200,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  halo: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.2,
  },
  iconWrap: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  eyebrow: {
    color: colors.brandPrimary,
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: "500",
  },
  title: {
    color: colors.onSurface,
    fontSize: 36,
    fontWeight: "500",
    letterSpacing: -1.2,
    lineHeight: 42,
    marginTop: spacing.sm,
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing.md,
    maxWidth: 340,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
    backgroundColor: "rgba(9,9,11,0.9)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceTertiary,
  },
  dotActive: {
    backgroundColor: colors.brandPrimary,
    width: 20,
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
  ctaText: {
    color: colors.onBrandPrimary,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});
