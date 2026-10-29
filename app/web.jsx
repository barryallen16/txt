// Web UI for people without the txt app (e.g. iOS).
//
// Paste a received ":txt Pay Rs ..." SMS to open a payment request, or build
// a formatted SMS to copy and send. Payment requests only — no SMS, camera,
// location or gallery access on the web.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
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
  validateAmount,
} from "../lib/upi";
import { colors, radius, space, type } from "../lib/theme";
import { copyText } from "../lib/clipboard";
import { useToast } from "../components/Toast";

// A copy action that always answers back: the label flips to "copied" briefly
// and a toast confirms it, so a click is never silently ignored.
function CopyButton({ get, label, style, textStyle, showLabel = true }) {
  const showToast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const press = async () => {
    const ok = await copyText(get());
    if (ok) {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    }
    showToast({
      message: ok ? `${label} copied` : "Copy is not supported here",
      type: ok ? "info" : "danger",
    });
  };

  return (
    <Pressable onPress={press} style={[styles.button, copied && styles.buttonCopied, style]}>
      <Text style={[type.button, { color: colors.accentInk }, textStyle]}>
        {copied ? "copied \u2713" : label}
      </Text>
    </Pressable>
  );
}

// Inline SVG logo, kept small so it renders cleanly on web.
const TXT_LOGO = (
  <svg width="40" height="40" viewBox="0 0 342 262" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.5116 80.1086H0.000571728V39.8606H20.5116V-0.000394821H81.6576V39.8606H108.361V80.1086H81.6576V200.853C81.6576 214.011 82.0446 220.977 96.3636 220.977H108.361V261.225H58.4376C27.8646 261.225 20.5116 244.197 20.5116 215.172V80.1086ZM165.21 167.184L143.925 261.225H89.7453L126.897 145.899L92.0673 39.8606H155.148L174.111 125.388H174.885L193.848 39.8606H248.415L212.424 145.899L251.511 261.225H187.269L165.984 167.184H165.21ZM253.362 80.1086H232.851V39.8606H253.362V-0.000394821H314.508V39.8606H341.211V80.1086H314.508V200.853C314.508 214.011 314.895 220.977 329.214 220.977H341.211V261.225H291.288C260.715 261.225 253.362 244.197 253.362 215.172V80.1086Z" fill="#e6e7eb"/>
  </svg>
);

// One heading style: theme label type, uppercased like the native screens.
const head = { ...type.label, textTransform: "uppercase" };

export default function WebScreen() {
  const showToast = useToast();

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
      showToast({ message: "Opening your UPI app..." });
    } catch {
      // On desktop browsers the upi:// scheme won't open anything; the amount
      // and the link are still copyable below.
      showToast({
        message: "Desktop browsers cannot open UPI links. Use copy below.",
        type: "danger",
      });
    }
  };

  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [smsText, setSmsText] = useState("");

  const mobileCheck = buildMobilePaymentLink({ mobileOrVpa: payee });
  // An empty amount is allowed (the naked request still works); anything
  // typed must survive validateAmount before it lands in the SMS text.
  const amountCheck = validateAmount(amount, null);
  const amountReady = amount.trim() === "" ? true : amountCheck.valid;

  const createSms = () => {
    if (!mobileCheck.valid || !mobileCheck.link || !amountReady) return;
    const amountValue = amountCheck.valid ? amountCheck.amount : null;
    const bodyText = amountValue ? `Pay Rs ${amountValue}` : "Pay";
    const base = `:txt ${bodyText} ${mobileCheck.link}`;
    setSmsText(note.trim() ? `${base} (${note.trim()})` : base);
  };

  const copySms = async () => {
    if (!smsText) return;
    const ok = await copyText(smsText);
    showToast({ message: ok ? "SMS copied" : "Copy is not supported here", type: ok ? "info" : "danger" });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          {TXT_LOGO}
          <View style={styles.brandTextWrapper}>
            <Text style={[type.muted, styles.brandSub]}>txt · web</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[head, styles.sectionHead]}>open a request</Text>
          <Text style={[type.muted, styles.sectionNote]}>
            paste the ":txt pay rs ..." sms you received
          </Text>

          <View style={styles.card}>
            <TextInput
              value={pasteText}
              onChangeText={setPasteText}
              placeholder="paste the sms text here…"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={styles.input}
            />
            {pasteText.length > 0 && !pasteCheck && !pasteError ? (
              <Text style={[type.muted, styles.hint]}>no :txt payment request found.</Text>
            ) : null}
            {pasteError ? (
              <Text style={[type.muted, { color: colors.danger }]}>{pasteError}</Text>
            ) : null}
            <Pressable
              onPress={useRequest}
              disabled={!pasteCheck}
              style={[styles.button, !pasteCheck && styles.buttonDisabled]}
            >
              <Text style={[type.button, { color: !pasteCheck ? colors.muted : colors.accentInk }]}>
                use request
              </Text>
            </Pressable>
          </View>
        </View>

        {parsed ? (
          <View style={styles.section}>
            <Text style={[head, styles.sectionHead]}>payment request</Text>
            <View style={styles.card}>
              <Text style={type.bodyMedium}>{parsed.upi.pn || parsed.upi.pa}</Text>
              <Text style={type.muted}>{parsed.upi.pa}</Text>
              {parsed.amount ? (
                <Text style={{ ...type.amountSmall, fontSize: 24 }}>
                  ₹{parsed.amount}
                </Text>
              ) : null}
              <View style={styles.buttonRow}>
                <Pressable onPress={payWithUpi} style={styles.button}>
                  <Text style={[type.button, { color: colors.accentInk }]}>pay with upi</Text>
                </Pressable>
              </View>
              <View style={styles.buttonRow}>
                {parsed.amount ? (
                  <CopyButton
                    get={() => String(parsed.amount ?? "")}
                    label="copy amount"
                    style={styles.buttonRowItem}
                  />
                ) : null}
                <CopyButton
                  get={() => parsed.link}
                  label="copy link"
                  style={styles.buttonRowItem}
                />
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[head, styles.sectionHead]}>create a request</Text>
          <Text style={[type.muted, styles.sectionNote]}>
            build the formatted sms, copy it, then send it from your phone.
          </Text>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={[head]}>payee (mobile or upi id)</Text>
              <TextInput
                value={payee}
                onChangeText={setPayee}
                placeholder="9876543210 or name@okhdfc"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              {payee.length > 0 && !mobileCheck.valid ? (
                <Text style={[type.muted, { color: colors.danger }]}>{mobileCheck.reason}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={[head]}>amount (₹)</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              {amount.length > 0 && !amountCheck.valid ? (
                <Text style={[type.muted, { color: colors.danger }]}>{amountCheck.reason}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={[head]}>note (optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="dinner, rent"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <Pressable
              onPress={createSms}
              disabled={!mobileCheck.valid || !amountReady}
              style={[styles.button, (!mobileCheck.valid || !amountReady) && styles.buttonDisabled]}
            >
              <Text style={[type.button, { color: !mobileCheck.valid || !amountReady ? colors.muted : colors.accentInk }]}>
                create sms
              </Text>
            </Pressable>
          </View>
        </View>

        {smsText ? (
          <View style={styles.section}>
            <Text style={[head, styles.sectionHead]}>sms to send</Text>
            <View style={styles.card}>
              <TextInput
                value={smsText}
                editable={false}
                style={styles.input}
                numberOfLines={2}
              />
              <View style={styles.buttonRow}>
                <Pressable onPress={copySms} style={styles.button}>
                  <Text style={[type.button, { color: colors.accentInk }]}>copy sms</Text>
                </Pressable>
              </View>
              <Text style={[muted, styles.noteText]}>
                open your sms app, paste this into a new message and send it to
                the payee.
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={[type.muted, styles.footerNote]}>
          txt sends everything as plain sms. the receiver needs nothing but the
          message - no app, no data plan.
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
    gap: space.md,
    paddingBottom: space.xxl,
  },
  brand: {
    alignItems: "center",
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  brandTextWrapper: {
    marginTop: space.xs,
  },
  brandSub: {
    fontSize: 12,
    letterSpacing: 1,
  },
  section: {
    marginBottom: space.lg,
  },
  sectionHead: {
    marginBottom: space.xs,
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
    marginBottom: space.md,
  },
  input: {
    minHeight: 44,
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
  buttonCopied: {
    opacity: 0.85,
  },
  buttonRowItem: {
    flex: 1,
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
