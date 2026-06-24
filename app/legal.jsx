import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AppHeader from "../components/AppHeader";
import { colors, radius, space, type } from "../lib/theme";

const MIT_LICENSE = `MIT License

Copyright (c) 2026 barryallen16

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const TABS = [
  {
    key: "terms",
    label: "TERMS",
    intro: "Rules for using txt. Last updated October 2026.",
    sections: [
      {
        title: "What this is",
        body: "txt composes and sends SMS that carry pictures, QR codes, live location and payment requests. It is a messaging tool, not a payment service, carrier or bank.",
      },
      {
        title: "Carrier charges",
        body: "Every SMS txt sends is billed to you by your mobile carrier. Message and data rates apply, and txt has no control over them.",
      },
      {
        title: "Payments",
        body: "txt never holds, moves or sees money. A payment request is just an SMS link; opening it takes you to your UPI or bank app. Those payments follow your bank's and NPCI's terms, and any dispute is between you, the recipient and your bank.",
      },
      {
        title: "Location",
        body: "Location is read only while you run a share, and each update goes out as an SMS. Stop the share to stop sharing.",
      },
      {
        title: "Delivery",
        body: "SMS delivery depends on your carrier and the recipient's carrier. txt cannot guarantee that a message arrives, arrives whole, or arrives on time.",
      },
      {
        title: "No warranty",
        body: "txt is provided as is, under the MIT license, without warranty of any kind.",
      },
      {
        title: "Liability",
        body: "txt is not liable for carrier charges, failed or delayed messages, payment disputes, or anything else arising from use.",
      },
      {
        title: "Changes",
        body: "These terms may change with app updates. The current version always lives on this screen.",
      },
    ],
  },
  {
    key: "privacy",
    label: "PRIVACY",
    intro: "The whole policy, short: nothing about you is collected.",
    sections: [
      {
        title: "Nothing is collected",
        body: "txt has no servers, no accounts and no analytics. Nothing about you is collected, transmitted or sold.",
      },
      {
        title: "What stays on your phone",
        body: "Transfer records, favorite contacts and settings live in a database on your device. Deleting the app deletes them.",
      },
      {
        title: "What leaves your phone",
        body: "Only the SMS you choose to send, through your carrier, to the recipient you picked. SMS is not encrypted, so write accordingly.",
      },
      {
        title: "Permissions",
        body: "Messages and notifications are read to reassemble incoming items. The camera reads QR codes you point it at. Location is read only during a share. Contacts are read only when you pick a recipient.",
      },
      {
        title: "Questions",
        body: "Open an issue on the project's GitHub repository.",
      },
    ],
  },
  {
    key: "license",
    label: "LICENSE",
    intro: "txt is free software, released under the MIT License.",
    sections: [],
  },
];

export default function LegalScreen() {
  const [tab, setTab] = useState(TABS[0].key);
  const current = TABS.find((entry) => entry.key === tab);

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <AppHeader
        title="Legal"
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
      />

      <View style={styles.tabBar}>
        {TABS.map((entry) => (
          <Pressable
            key={entry.key}
            onPress={() => setTab(entry.key)}
            accessibilityRole="tab"
            accessibilityLabel={entry.label}
            accessibilityState={{ selected: entry.key === tab }}
            style={[styles.tab, entry.key === tab && styles.tabActive]}
          >
            <Text
              style={[type.label, entry.key === tab && styles.tabLabelActive]}
            >
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.muted, styles.intro]}>{current.intro}</Text>

        {current.sections.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={type.bodyMedium}>{section.title}</Text>
            <Text style={type.muted}>{section.body}</Text>
          </View>
        ))}

        {current.key === "license" ? (
          <View style={styles.card}>
            <Text style={type.muted}>{MIT_LICENSE}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: space.lg,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: space.md,
  },
  tabActive: {
    backgroundColor: colors.line,
  },
  tabLabelActive: {
    color: colors.text,
  },
  content: {
    padding: space.lg,
    gap: space.md,
  },
  intro: {
    marginBottom: space.sm,
  },
  card: {
    gap: space.xs,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
  },
});
