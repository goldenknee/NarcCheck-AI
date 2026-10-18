import { useEffect, useState } from "react";
import { Dimensions, Platform, ScaledSize } from "react-native";

/**
 * Returns true when the app is running on a desktop-sized web viewport.
 * On native (iOS) always returns false. Re-measures on viewport resize.
 */
export function useIsDesktop(breakpoint = 1024): boolean {
  const getIsDesktop = () =>
    Platform.OS === "web" && Dimensions.get("window").width >= breakpoint;

  const [isDesktop, setIsDesktop] = useState<boolean>(getIsDesktop);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onChange = ({ window }: { window: ScaledSize }) => {
      setIsDesktop(window.width >= breakpoint);
    };
    const sub = Dimensions.addEventListener("change", onChange);
    return () => sub.remove();
  }, [breakpoint]);

  return isDesktop;
}
