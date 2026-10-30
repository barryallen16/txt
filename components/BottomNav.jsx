import { useCallback, useEffect, useState } from "react";
import {
  DeviceEventEmitter,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import PixelIcon from "./PixelIcon";
import { colors, fonts, radius, space, type } from "../lib/theme";
import { listRequests } from "../lib/db";
import { INBOX_SYNCED_EVENT } from "../lib/syncInbox";

const TABS = [
  {
    key: "scan",
    route: "/",
    label: "SCAN",
    icon: "qr",
  },
  {
    key: "send",
    route: "/share",
    label: "SEND",
    icon: "send",
  },
  {
    key: "inbox",
    route: "/transfers",
    label: "INBOX",
    icon: "inbox",
  },
  {
    key: "requests",
    route: "/sms-payments",
    label: "REQUESTS",
    icon: "message-text",
  },
];

export default function BottomNav({ current }) {
  if (Platform.OS === "web") return null;

  const insets = useSafeAreaInsets();
  const [openCount, setOpenCount] = useState(0);

  const checkBadge = useCallback(() => {
    try {
      const open = listRequests("open").length;
      setOpenCount(open);
    } catch {
      setOpenCount(0);
    }
  }, []);

  useEffect(() => {
    checkBadge();
    const sub = DeviceEventEmitter.addListener(INBOX_SYNCED_EVENT, checkBadge);
    return () => sub.remove();
  }, [checkBadge]);

  const onPressTab = (tab) => {
    if (tab.key === current) return;
    router.replace(tab.route);
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(space.xs, insets.bottom) },
      ]}
      accessibilityRole="tablist"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === current;
        const color = isActive ? colors.text : colors.muted;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onPressTab(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              styles.tab,
              pressed && styles.tabPressed,
              isActive && styles.tabActive,
            ]}
          >
            <View style={styles.iconWrapper}>
              <PixelIcon name={tab.icon} size={22} color={color} />
              {tab.key === "requests" && openCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {openCount > 9 ? "9+" : openCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.tabLabel,
                { color },
                isActive && styles.tabLabelActive,
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {isActive ? <View style={styles.activeIndicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    minHeight: 56,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: space.xs,
    paddingBottom: 2,
    gap: 3,
    minHeight: 48,
  },
  tabPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
  tabActive: {},
  iconWrapper: {
    position: "relative",
    width: 28,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontFamily: fonts.pixel,
    fontSize: 10,
    letterSpacing: 1,
  },
  tabLabelActive: {
    color: colors.text,
  },
  activeIndicator: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
    marginTop: 1,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -6,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.accentInk,
    fontSize: 9,
    fontFamily: fonts.semibold,
    lineHeight: 11,
    fontVariant: ["tabular-nums"],
  },
});
