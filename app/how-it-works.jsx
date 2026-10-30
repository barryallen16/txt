import { useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AppButton from "../components/AppButton";
import AppHeader from "../components/AppHeader";
import PixelIcon from "../components/PixelIcon";
import { getMeta } from "../lib/db";
import { colors, radius, space, type } from "../lib/theme";

function readFirstRun() {
  try {
    return getMeta("onboarding_complete") !== "1";
  } catch {
    return false;
  }
}

const SECTIONS = [
  {
    icon: "message-text",
    title: "What txt is",
    body: [
      "txt sends pictures, QR codes, live location and payment requests over plain SMS.",
      "Neither phone needs a data plan. Every message travels the same route as a normal text.",
    ],
  },
  {
    icon: "send",
    title: "Sending something",
    body: [
      "Scan a UPI QR code on the home screen to request money, or open the send screen to share a photo, a code or your location.",
      "The recipient picks up every item in their Messages app, like any other text.",
    ],
  },
  {
    icon: "inbox",
    title: "Receiving something",
    body: [
      "Install txt on both phones. It reassembles the parts of an incoming message into the whole picture, code or location.",
      "New items land in the inbox and raise an alert when message access is on.",
    ],
  },
  {
    icon: "shield",
    title: "The fine print",
    body: [
      "Every SMS is billed by your carrier. Message and data rates apply.",
      "txt never touches money. A payment request opens in your UPI app and follows your bank's terms.",
      "Location is shared only while a share is running, and you start it yourself.",
    ],
  },
];

export default function HowItWorksScreen() {
  const [firstRun] = useState(readFirstRun);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <AppHeader
        title="How txt works"
        onBack={firstRun ? undefined : close}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          {firstRun ? (
            <Image
              source={require("../assets/txt-s500.png")}
              style={styles.logo}
              accessibilityLabel="txt"
            />
          ) : (
            <PixelIcon name="info" size={24} color={colors.text} />
          )}
          <Text style={[type.heading, styles.center]}>
            {firstRun ? "Welcome to txt" : "How txt works"}
          </Text>
          <Text style={[type.muted, styles.center]}>
            {firstRun
              ? "Takes a minute to learn. No internet needed, ever."
              : "A quick tour of what txt does and what it costs."}
          </Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <View style={styles.cardTop}>
              <PixelIcon name={section.icon} size={20} color={colors.text} />
              <Text style={type.bodyMedium}>{section.title}</Text>
            </View>
            {section.body.map((line) => (
              <Text key={line} style={[type.muted, styles.bodyLine]}>
                {line}
              </Text>
            ))}
          </View>
        ))}

        <Pressable
          onPress={() => Linking.openURL("https://github.com/barryallen16/txt")}
          accessibilityRole="link"
          accessibilityLabel="Star txt on GitHub"
          hitSlop={8}
          style={({ pressed }) => [styles.githubCard, pressed && styles.githubCardPressed]}
        >
          <View style={styles.githubCardLeft}>
            <PixelIcon name="star" size={20} color="#D83995" />
            <View style={styles.githubCardText}>
              <Text style={type.bodyMedium}>Star txt on GitHub</Text>
              <Text style={type.muted}>100% free and open source</Text>
            </View>
          </View>
          <PixelIcon name="arrow-right" size={16} color={colors.accent} />
        </Pressable>

        <Pressable
          onPress={() => router.push("/legal")}
          accessibilityRole="link"
          accessibilityLabel="Read the terms"
          hitSlop={8}
          style={styles.termsLink}
        >
          <Text style={[type.label, styles.termsText]}>READ THE TERMS</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label={firstRun ? "Agree and continue" : "Done"}
          onPress={() => {
            if (!firstRun) return close();
            // Accepting the terms here means the setup can continue.
            router.replace("/permissions");
          }}
        />
        {!firstRun ? (
          <Pressable
            onPress={() => router.push("/permissions")}
            accessibilityRole="button"
            accessibilityLabel="Open permission settings"
            hitSlop={8}
            style={({ pressed }) => [
              styles.permLink,
              pressed && styles.permLinkPressed,
            ]}
          >
            <PixelIcon name="shield" size={16} color={colors.muted} />
            <Text style={type.label}>PERMISSIONS</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: space.lg,
    gap: space.md,
  },
  intro: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.lg,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: space.md,
  },
  center: {
    textAlign: "center",
  },
  card: {
    gap: space.sm,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  bodyLine: {
    flexShrink: 1,
  },
  githubCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
  },
  githubCardPressed: {
    backgroundColor: colors.line,
    opacity: 0.9,
  },
  githubCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  githubCardText: {
    gap: 2,
  },
  termsLink: {
    alignSelf: "center",
    paddingVertical: space.sm,
  },
  termsText: {
    color: colors.accent,
  },
  footer: {
    gap: space.sm,
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  permLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius,
  },
  permLinkPressed: {
    backgroundColor: colors.line,
  },
});
