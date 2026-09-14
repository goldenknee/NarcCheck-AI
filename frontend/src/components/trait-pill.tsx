import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/src/theme";

export function TraitPill({ label, testID }: { label: string; testID?: string }) {
  return (
    <View style={styles.pill} testID={testID}>
      <View style={styles.dot} />
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandPrimary,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brandPrimary,
  },
  text: {
    color: colors.onBrandTertiary,
    fontSize: 12,
    fontWeight: "500",
  },
});
export { spacing };
