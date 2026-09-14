// Design tokens for Narc — strict dark mode from /app/design_guidelines.json
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  // Surfaces
  surface: "#09090B",
  onSurface: "#FAFAFA",
  surfaceSecondary: "#18181B",
  onSurfaceSecondary: "#F4F4F5",
  surfaceTertiary: "#27272A",
  onSurfaceTertiary: "#E4E4E7",
  surfaceInverse: "#FAFAFA",
  onSurfaceInverse: "#09090B",
  muted: "#A1A1AA",

  // Brand
  brand: "#DC2626",
  onBrand: "#FAFAFA",
  brandPrimary: "#DC2626",
  onBrandPrimary: "#FAFAFA",
  brandSecondary: "#F59E0B",
  onBrandSecondary: "#18181B",
  brandTertiary: "#7F1D1D",
  onBrandTertiary: "#FECACA",

  // Status
  success: "#16A34A",
  onSuccess: "#F0FDF4",
  warning: "#D97706",
  onWarning: "#FFFBEB",
  error: "#B91C1C",
  onError: "#FEF2F2",
  info: "#DC2626",
  onInfo: "#FAFAFA",

  // Lines
  border: "#27272A",
  borderStrong: "#3F3F46",
  divider: "#27272A",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}

// Force dark for Narc — spec requires strict dark mode.
setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = "dark";
  void system;
  return { scheme, colors: themes.dark };
}

export const colors = themes.dark;

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};
