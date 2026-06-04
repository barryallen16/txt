import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TxtLogo from "../assets/txt.svg";
import IconButton from "./IconButton";
import { useSmsQuota } from "../lib/quota";
import { colors, space, type } from "../lib/theme";

export default function AppHeader({
  title,
  showLogo = false,
  onBack,
  backLabel = "Go back",
  right,
}) {
  const insets = useSafeAreaInsets();
  const quota = useSmsQuota();

  return (
    <View style={[styles.container, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.bar}>
        <View style={styles.side}>
          {onBack ? (
            <IconButton icon="arrow-left" label={backLabel} onPress={onBack} />
          ) : null}
        </View>
        <View style={[styles.side, styles.right]}>
          {right}
          {quota ? (
            <Text
              style={[
                type.label,
                styles.quota,
                quota.remaining <= 10 && styles.quotaLow,
              ]}
              numberOfLines={1}
              accessibilityLabel={`${quota.remaining} of ${quota.limit} SMS left today`}
            >
              {quota.used}/{quota.limit} SMS
            </Text>
          ) : null}
        </View>
        <View pointerEvents="none" style={styles.center}>
          {showLogo ? (
            <TxtLogo width={32} height={24} accessibilityLabel="txt" />
          ) : null}
          {title ? (
            <Text style={[type.heading, styles.title]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.bg,
  },
  bar: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
  },
  side: {
    flex: 1,
    justifyContent: "center",
  },
  right: {
    flex: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.xs,
  },
  center: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: 48,
  },
  title: {
    flexShrink: 1,
    textAlign: "center",
  },
  quota: {
    fontSize: 10,
    letterSpacing: 0.5,
    fontVariant: ["tabular-nums"],
  },
  quotaLow: {
    color: colors.danger,
  },
});
