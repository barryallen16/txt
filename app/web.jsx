// Web UI for people without the txt app (e.g. iOS).
//
// Paste a received ":txt Pay Rs ..." SMS to open a payment request, or build
// a formatted SMS to copy and send. Payment requests only — no SMS, camera,
// location or gallery access on the web.
import { useMemo, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  buildMobilePaymentLink,
  extractRequestAmount,
  extractUpiLink,
  normalizeAmount,
  parseUpiLink,
} from "../lib/upi";
import { colors, radius, space } from "../lib/theme";
import { useToast } from "../components/Toast";

const copyToClipboard = async (text) => {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
};

const heading = {
  fontFamily: "monospace",
  fontSize: 15,
  letterSpacing: 1,
  color: colors.muted,
  textTransform: "uppercase",
};
const body = {
  fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  fontSize: 15,
  color: colors.text,
};
const bodyMedium = { ...body, fontWeight: "600" };
const muted = {
  fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  fontSize: 13,
  color: colors.muted,
};
const buttonText = {
  fontFamily: "monospace",
  fontSize: 13,
  letterSpacing: 1,
  color: colors.accentInk,
};

export default function WebScreen() {
  const showToast = useToast();

  // ---------- Paste to use ----------
  const [pasteText, setPasteText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [pasteError, setPasteError] = useState(null);

  const pasteCheck = useMemo(() => {
    const link = extractUpiLink(pasteText);
    if (!link) return null;
    const upi = parseUpiLink(link);
    if (!upi.valid) return null;
    const amount = extractRequestAmount(pasteText) || normalizeAmount(upi.am);
    return { link, upi, amount };
  }, [pasteText]);

  const useRequest = () => {
    setPasteError(null);
    if (!pasteCheck) {
      setPasteError("No payment request found in that text.");
      return;
    }
    setParsed(pasteCheck);
  };

  const payWithUpi = async () => {
    if (!parsed) return;
    try {
      await Linking.openURL(parsed.link);
    } catch {
      // On desktop browsers the upi:// scheme won't open anything; the link is
      // still copyable below.
    }
  };

  // ---------- Create a request ----------
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [smsText, setSmsText] = useState("");

  const mobileCheck = buildMobilePaymentLink({
    mobileOrVpa: payee,
    amount: amount || undefined,
    name: note ? null : undefined,
    note,
  });

  const createSms = () => {
    if (!mobileCheck.valid || !mobileCheck.link) return;
    const bodyText = amount ? `Pay Rs ${amount}` : "Pay";
    setSmsText(`:txt ${bodyText} ${mobileCheck.link}`);
  };

  const copySms = async () => {
    if (!smsText) return;
    const ok = await copyToClipboard(smsText);
    showToast({ message: ok ? "SMS copied" : "Copy not supported on this browser" });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Text style={styles.brandText}>txt</Text>
          <Text style={[muted, styles.brandSub]}>
            Web · payment requests
          </Text>
        </View>

        <Text style={[heading, styles.sectionHead]}>Open a request</Text>
        <Text style={[muted, styles.sectionNote]}>
          Paste the ":txt Pay Rs ..." SMS you received.
        </Text>

        <View style={styles.card}>
          <TextInput
            value={pasteText}
            onChangeText={setPasteText}
            placeholder="Paste the SMS text here…"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            style={styles.input}
          />
          {pasteText.length > 0 && !pasteCheck && !pasteError ? (
            <Text style={[muted, styles.hint]}>No :txt payment request found.</Text>
          ) : null}
          {pasteError ? (
            <Text style={[muted, { color: colors.danger }]}>{pasteError}</Text>
          ) : null}
          <Pressable
            onPress={useRequest}
            disabled={!pasteCheck}
            style={[styles.button, !pasteCheck && styles.buttonDisabled]}
          >
            <Text style={[buttonText, { color: !pasteCheck ? colors.muted : colors.accentInk }]}>
              Use request
            </Text>
          </Pressable>
        </View>

        {parsed ? (
          <View style={styles.card}>
            <Text style={[heading, styles.sectionHead]}>Payment request</Text>
            <Text style={[bodyMedium]}>{parsed.upi.pn || parsed.upi.pa}</Text>
            <Text style={[muted]}>{parsed.upi.pa}</Text>
            {parsed.amount ? (
              <Text style={[bodyMedium, { fontSize: 22 }]}>
                ₹{parsed.amount}
              </Text>
            ) : null}
            <View style={styles.buttonRow}>
              <Pressable onPress={payWithUpi} style={styles.button}>
                <Text style={buttonText}>Pay with UPI</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const ok = await copyToClipboard(parsed.link);
                  showToast({ message: ok ? "Link copied" : "Copy not supported" });
                }}
                style={styles.buttonOutline}
              >
                <Text style={[buttonText, { color: colors.muted }]}>Copy link</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={[heading, styles.sectionHead]}>Create a request</Text>
        <Text style={[muted, styles.sectionNote]}>
          Build the formatted SMS, copy it, then send it from your phone.
        </Text>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={[heading]}>Payee (mobile or UPI ID)</Text>
            <TextInput
              value={payee}
              onChangeText={setPayee}
              placeholder="9876543210 or name@okhdfc"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            {payee.length > 0 && !mobileCheck.valid ? (
              <Text style={[muted, { color: colors.danger }]}>
                {mobileCheck.reason}
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={[heading]}>Amount (₹)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={[heading]}>Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Dinner, Rent"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>

          <Pressable
            onPress={createSms}
            disabled={!mobileCheck.valid}
            style={[styles.button, !mobileCheck.valid && styles.buttonDisabled]}
          >
            <Text style={[buttonText, { color: !mobileCheck.valid ? colors.muted : colors.accentInk }]}>
              Create SMS
            </Text>
          </Pressable>
        </View>

        {smsText ? (
          <View style={styles.card}>
            <Text style={[heading]}>SMS to send</Text>
            <TextInput
              value={smsText}
              editable={false}
              style={styles.input}
              numberOfLines={2}
            />
            <View style={styles.buttonRow}>
              <Pressable onPress={copySms} style={styles.button}>
                <Text style={buttonText}>Copy SMS</Text>
              </Pressable>
            </View>
            <Text style={[muted, styles.noteText]}>
              Open your SMS app, paste this into a new message and send it to
              the payee.
            </Text>
          </View>
        ) : null}

        <Text style={[muted, styles.footerNote]}>
          txt sends everything as plain SMS. The receiver needs nothing but the
          message — no app, no data plan.
        </Text>
      </ScrollView>
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
    gap: space.lg,
    minHeight: "100%",
  },
  brand: {
    alignItems: "center",
    paddingVertical: space.lg,
  },
  brandText: {
    fontFamily: "monospace",
    fontSize: 22,
    letterSpacing: 1,
    color: colors.text,
  },
  brandSub: {
    marginTop: 4,
  },
  sectionHead: {
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  sectionNote: {
    marginBottom: space.md,
  },
  card: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
  },
  field: {
    gap: space.xs,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.bg,
    color: colors.text,
    fontSize: 15,
  },
  hint: {
    marginTop: space.xs,
  },
  button: {
    marginTop: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: colors.line,
    opacity: 0.5,
  },
  buttonOutline: {
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.sm,
  },
  noteText: {
    marginTop: space.sm,
  },
  footerNote: {
    marginTop: space.xl,
    textAlign: "center",
  },
});
