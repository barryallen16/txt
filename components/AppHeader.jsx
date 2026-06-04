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
        {onBack ? (
          <IconButton icon="arrow-left" label={backLabel} onPress={onBack} />
        ) : null}
        {showLogo ? (
          <View style={styles.brand}>
            <TxtLogo width={32} height={24} accessibilityLabel="txt" />
          </View>
        ) : null}
        {title ? (
          <Text
            style={[type.heading, styles.title]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {title}
          </Text>
        ) : null}
        <View style={styles.spacer} />
        <View style={styles.right}>
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
  brand: {
    justifyContent: "center",
    paddingHorizontal: space.xs,
  },
  title: {
    flexShrink: 1,
    marginLeft: space.sm,
  },
  spacer: {
    flex: 1,
  },
  right: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.xs,
    marginLeft: space.xs,
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
