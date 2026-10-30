import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import PixelIcon from "../components/PixelIcon";
import { colors, radius, radiusLg, space, type } from "../lib/theme";

const OPTIONS = [
  {
    icon: "location",
    title: "Current location",
    detail: "One pin, sent once. Nothing follows it.",
    href: "/share/location-once",
  },
  {
    icon: "location",
    title: "Live location",
    detail: "Text your coordinates every 30 s, 1 min or 5 min.",
    href: "/share/location",
  },
  {
    icon: "image",
    title: "Picture",
    detail: "Compressed to a few KB, greyscale, sent as one message.",
    href: "/share/image",
  },
  {
    icon: "qr",
    title: "QR code",
    detail: "Tickets, passes, payment codes. The text travels, the code rebuilds.",
    href: "/share/qr",
  },
  {
    icon: "rupee",
    title: "Payment request",
    detail: "Request money to a mobile number or UPI ID without a QR code.",
    href: "/pay/manual",
  },
];

export default function ShareScreen() {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <AppHeader title="Send" />

      <View style={styles.body}>
        {OPTIONS.map((option) => (
          <Pressable
            key={option.href}
            onPress={() => router.push(option.href)}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <PixelIcon name={option.icon} size={24} color={colors.text} />
            <View style={styles.rowText}>
              <Text style={type.bodyMedium}>{option.title}</Text>
              <Text style={type.muted}>{option.detail}</Text>
            </View>
            <PixelIcon name="arrow-right" size={16} color={colors.muted} />
          </Pressable>
        ))}

        <Text style={[type.muted, styles.note]}>
          Everything leaves as plain SMS, so it works with no data plan and the
          other side needs nothing but the message.
        </Text>
      </View>
      <BottomNav current="send" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    padding: space.lg,
    gap: space.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radiusLg,
    backgroundColor: colors.panel,
    ...(Platform.OS === "web" ? { cursor: "pointer", userSelect: "none" } : {}),
  },
  rowPressed: {
    backgroundColor: colors.line,
    transform: [{ scale: 0.985 }],
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  linkButton: {
    justifyContent: "center",
    paddingHorizontal: space.sm,
    minHeight: 40,
  },
  note: {
    marginTop: "auto",
    paddingBottom: space.sm,
  },
});
