// Web UI for people without the native txt Android app (e.g. iOS or desktop).
//
// Paste a received ":txt Pay Rs ..." SMS to view the QR code and pay with your UPI app,
// or generate a formatted offline SMS request to send to someone else.
// All operations run 100% client-side with zero server involvement.
import { useEffect, useMemo, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import {
  buildMobilePaymentLink,
  extractRequestAmount,
  extractUpiLink,
  normalizeAmount,
  isMerchantUpi,
  isPersonalUpi,
  parseUpiLink,
  validateAmount,
} from "../lib/upi";
import { fonts, radius, radiusLg, radiusSm, space, type } from "../lib/theme";
import { copyText } from "../lib/clipboard";
import { useToast } from "../components/Toast";
import PixelIcon from "../components/PixelIcon";

// Requested palette: #0593C6, #FCFFFF, #D83995 on #02070A
const themeColors = {
  bg: "#02070A",
  panel: "#07131D",
  panelAlt: "#0A1B28",
  line: "#0E2638",
  lineBright: "#163C57",
  text: "#FCFFFF",
  muted: "#7D98AB",
  cyan: "#0593C6",
  cyanHover: "#0480AC",
  cyanInk: "#02070A",
  coral: "#D83995",
  coralHover: "#BE2E82",
  coralInk: "#02070A",
  danger: "#FF5C5C",
};

// Sideload APK direct download link
const RELEASES_URL = "https://github.com/barryallen16/txt/releases/latest";

// The official txt logo in SVG format
function TxtLogo({ size = 32, color = themeColors.text }) {
  return (
    <svg width={size} height={size * (262 / 342)} viewBox="0 0 342 262" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20.5116 80.1086H0.000571728V39.8606H20.5116V-0.000394821H81.6576V39.8606H108.361V80.1086H81.6576V200.853C81.6576 214.011 82.0446 220.977 96.3636 220.977H108.361V261.225H58.4376C27.8646 261.225 20.5116 244.197 20.5116 215.172V80.1086ZM165.21 167.184L143.925 261.225H89.7453L126.897 145.899L92.0673 39.8606H155.148L174.111 125.388H174.885L193.848 39.8606H248.415L212.424 145.899L251.511 261.225H187.269L165.984 167.184H165.21ZM253.362 80.1086H232.851V39.8606H253.362V-0.000394821H314.508V39.8606H341.211V80.1086H314.508V200.853C314.508 214.011 314.895 220.977 329.214 220.977H341.211V261.225H291.288C260.715 261.225 253.362 244.197 253.362 215.172V80.1086Z"
        fill={color}
      />
    </svg>
  );
}

// Quick amount increment presets for rapid invoice building
const AMOUNT_PRESETS = [100, 200, 500, 1000, 2000];

export default function WebScreen() {
  const showToast = useToast();
  const params = useLocalSearchParams();

  // Tab state: "open" (view/pay request) or "create" (generate SMS)
  const initialParamText =
    typeof params?.text === "string"
      ? params.text
      : typeof params?.link === "string"
      ? params.link
      : "";

  const [activeTab, setActiveTab] = useState("open");
  const [pasteText, setPasteText] = useState(initialParamText);
  const [parsed, setParsed] = useState(null);
  const [pasteError, setPasteError] = useState(null);

  // Form states for creating a request
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [smsText, setSmsText] = useState("");

  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [smsCopied, setSmsCopied] = useState(false);

  // Auto-parse on param or initial text
  useEffect(() => {
    if (initialParamText && !parsed) {
      const link = extractUpiLink(initialParamText);
      if (link) {
        const upi = parseUpiLink(link);
        if (upi.valid) {
          const amt = extractRequestAmount(initialParamText) || normalizeAmount(upi.am);
          setParsed({ link, upi, amount: amt });
          setActiveTab("open");
        }
      }
    }
  }, [initialParamText]);

  // Real-time verification of pasted text
  const pasteCheck = useMemo(() => {
    if (!pasteText.trim()) return null;
    const link = extractUpiLink(pasteText);
    if (!link) return null;
    const upi = parseUpiLink(link);
    if (!upi.valid) return null;
    const amt = extractRequestAmount(pasteText) || normalizeAmount(upi.am);
    return { link, upi, amount: amt };
  }, [pasteText]);

  const handleUseRequest = () => {
    setPasteError(null);
    if (!pasteCheck) {
      setPasteError("No valid UPI payment link found in the text.");
      return;
    }
    setParsed(pasteCheck);
    showToast({ message: "Payment request loaded", type: "info" });
  };

  const handleClearRequest = () => {
    setParsed(null);
    setPasteText("");
    setPasteError(null);
  };

  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setPasteText(text);
          const link = extractUpiLink(text);
          if (link) {
            const upi = parseUpiLink(link);
            if (upi.valid) {
              const amt = extractRequestAmount(text) || normalizeAmount(upi.am);
              setParsed({ link, upi, amount: amt });
              showToast({ message: "Loaded from clipboard", type: "info" });
              return;
            }
          }
        }
      }
      showToast({ message: "Pasted text. Tap Load Request.", type: "info" });
    } catch {
      showToast({ message: "Clipboard permission not granted. Paste manually.", type: "danger" });
    }
  };

  const isDesktopWeb =
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const openUpiUri = async (url) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = url;
      return;
    }
    await Linking.openURL(url);
  };

  const copyUpiId = async () => {
    if (!parsed?.upi?.pa) return;
    const ok = await copyText(parsed.upi.pa);
    if (ok) {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      showToast({
        message: `UPI ID ${parsed.upi.pa} copied`,
        type: "info",
      });
    }
  };

  const copyPaymentLink = async () => {
    if (!parsed?.link) return;
    const ok = await copyText(parsed.link);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      showToast({ message: "UPI Payment URL copied", type: "info" });
    }
  };

  const payWithUpi = async () => {
    if (!parsed) return;
    if (isDesktopWeb) {
      showToast({
        message: "Desktop browsers cannot open UPI apps. Scan QR code with mobile camera.",
        type: "danger",
      });
      return;
    }
    try {
      await openUpiUri(parsed.link);
      showToast({ message: "Opening UPI app..." });
    } catch {
      showToast({
        message: "Could not open UPI app. Scan QR code or copy UPI ID.",
        type: "danger",
      });
    }
  };

  // Build SMS request calculations
  const mobileCheck = buildMobilePaymentLink({ mobileOrVpa: payee });
  const amountCheck = validateAmount(amount, null);
  const amountReady = amount.trim() === "" ? true : amountCheck.valid;

  const createSms = () => {
    if (!mobileCheck.valid || !mobileCheck.link || !amountReady) return;
    const amountValue = amountCheck.valid ? amountCheck.amount : null;
    const bodyText = amountValue ? `Pay Rs ${amountValue}` : "Pay";
    const base = `:txt ${bodyText} ${mobileCheck.link}`;
    const full = note.trim() ? `${base} (${note.trim()})` : base;
    setSmsText(full);
  };

  // Auto-generate SMS whenever valid inputs change
  useEffect(() => {
    if (mobileCheck.valid && mobileCheck.link && amountReady && (payee || amount)) {
      const amountValue = amountCheck.valid ? amountCheck.amount : null;
      const bodyText = amountValue ? `Pay Rs ${amountValue}` : "Pay";
      const base = `:txt ${bodyText} ${mobileCheck.link}`;
      setSmsText(note.trim() ? `${base} (${note.trim()})` : base);
    } else {
      setSmsText("");
    }
  }, [payee, amount, note, mobileCheck.valid, amountReady]);

  const handleCopySms = async () => {
    if (!smsText) return;
    const ok = await copyText(smsText);
    if (ok) {
      setSmsCopied(true);
      setTimeout(() => setSmsCopied(false), 2000);
      showToast({ message: "Formatted SMS copied", type: "info" });
    }
  };

  const handleOpenSmsApp = () => {
    if (!smsText) return;
    const uri = `sms:${mobileCheck.valid && mobileCheck.cleanPhone ? mobileCheck.cleanPhone : ""}?body=${encodeURIComponent(smsText)}`;
    Linking.openURL(uri).catch(() => {
      showToast({ message: "Could not launch SMS app. Use Copy SMS.", type: "danger" });
    });
  };

  const applyAmountPreset = (val) => {
    setAmount(String(val));
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <style>{`
        @font-face {
          font-family: 'GeistPixel';
          src: url('/assets/fonts/GeistPixel-Square.ttf') format('truetype');
          font-weight: 400;
          font-style: normal;
        }
        .txt-pixel-font {
          font-family: 'GeistPixel', monospace !important;
          font-weight: 400 !important;
          letter-spacing: 1px !important;
        }
      `}</style>

      {/* Top Utility Header */}
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => router.push("/")}
          style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
          accessibilityRole="link"
        >
          <PixelIcon name="arrow-left" size={14} color={themeColors.cyan} />
          <Text style={[type.label, { color: themeColors.cyan }]}>GUIDE & APK</Text>
        </Pressable>

        <View style={styles.brandGroup}>
          <TxtLogo size={28} />
          <View style={styles.webTag}>
            <Text style={[type.label, styles.webTagText]}>WEB UTILITY</Text>
          </View>
        </View>

        <Pressable
          onPress={() => Linking.openURL(RELEASES_URL)}
          style={({ pressed }) => [styles.apkNavBtn, pressed && styles.btnPressed]}
          accessibilityRole="link"
        >
          <PixelIcon name="download" size={13} color={themeColors.coral} />
          <Text style={[type.label, { color: themeColors.text, fontSize: 11 }]}>GET APK</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Interactive Segmented Tab Control */}
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setActiveTab("open")}
            style={[styles.tabItem, activeTab === "open" && styles.tabItemActive]}
          >
            <PixelIcon
              name="inbox"
              size={16}
              color={activeTab === "open" ? themeColors.cyanInk : themeColors.muted}
            />
            <Text
              style={[
                type.button,
                styles.tabText,
                { color: activeTab === "open" ? themeColors.cyanInk : themeColors.muted },
              ]}
            >
              OPEN REQUEST
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("create")}
            style={[styles.tabItem, activeTab === "create" && styles.tabItemActive]}
          >
            <PixelIcon
              name="send"
              size={16}
              color={activeTab === "create" ? themeColors.cyanInk : themeColors.muted}
            />
            <Text
              style={[
                type.button,
                styles.tabText,
                { color: activeTab === "create" ? themeColors.cyanInk : themeColors.muted },
              ]}
            >
              CREATE SMS
            </Text>
          </Pressable>
        </View>

        {/* ============================================================== */}
        {/* TAB 1: OPEN & PAY REQUEST FLOW                                 */}
        {/* ============================================================== */}
        {activeTab === "open" && (
          <View style={styles.tabContent}>
            {!parsed ? (
              // Empty / Input View
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <PixelIcon name="message-text" size={18} color={themeColors.cyan} />
                    <Text style={styles.cardTitle}>PASTE RECEIVED SMS</Text>
                  </View>
                  <Pressable
                    onPress={handlePasteClipboard}
                    style={({ pressed }) => [styles.miniActionBtn, pressed && styles.btnPressed]}
                  >
                    <PixelIcon name="copy" size={13} color={themeColors.cyan} />
                    <Text style={styles.miniActionText}>PASTE</Text>
                  </Pressable>
                </View>

                <Text style={styles.cardDesc}>
                  Received a <Text style={{ color: themeColors.coral }}>:txt Pay Rs</Text> SMS or UPI link?
                  Paste it here to open the payment request, display the QR code, or launch your UPI app.
                </Text>

                <TextInput
                  value={pasteText}
                  onChangeText={setPasteText}
                  placeholder="Paste SMS text here (e.g. :txt Pay Rs 500 upi://pay?pa=...)"
                  placeholderTextColor={themeColors.muted}
                  multiline
                  numberOfLines={4}
                  style={styles.textArea}
                />

                {pasteError ? (
                  <View style={styles.errorNotice}>
                    <PixelIcon name="info" size={14} color={themeColors.danger} />
                    <Text style={styles.errorNoticeText}>{pasteError}</Text>
                  </View>
                ) : null}

                {pasteText.length > 0 && pasteCheck ? (
                  <View style={styles.validPreviewNotice}>
                    <PixelIcon name="check" size={14} color={themeColors.cyan} />
                    <Text style={styles.validPreviewText}>
                      Valid payment request detected {pasteCheck.amount ? `for Rs ${pasteCheck.amount}` : ""}
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={handleUseRequest}
                  disabled={!pasteCheck}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    !pasteCheck && styles.btnDisabled,
                    pressed && pasteCheck && styles.btnPressed,
                  ]}
                >
                  <PixelIcon
                    name="arrow-right"
                    size={16}
                    color={!pasteCheck ? themeColors.muted : themeColors.cyanInk}
                  />
                  <Text
                    style={[
                      type.button,
                      { color: !pasteCheck ? themeColors.muted : themeColors.cyanInk },
                    ]}
                  >
                    LOAD PAYMENT REQUEST
                  </Text>
                </Pressable>
              </View>
            ) : (
              // Parsed Payment Invoice Card
              <View style={styles.invoiceCard}>
                <View style={styles.invoiceTopRow}>
                  <View style={styles.statusPill}>
                    <PixelIcon name="shield" size={13} color={themeColors.coral} />
                    <Text style={styles.statusPillText}>PAYMENT REQUEST</Text>
                  </View>

                  <Pressable
                    onPress={handleClearRequest}
                    style={({ pressed }) => [styles.resetBtn, pressed && styles.btnPressed]}
                  >
                    <PixelIcon name="close" size={12} color={themeColors.muted} />
                    <Text style={styles.resetBtnText}>CLEAR</Text>
                  </Pressable>
                </View>

                {/* Amount Callout */}
                <View style={styles.amountDisplayBlock}>
                  <Text style={styles.amountLabel}>AMOUNT DUE</Text>
                  <Text style={styles.amountNumber}>
                    {parsed.amount ? `₹${parsed.amount}` : "OPEN AMOUNT"}
                  </Text>
                </View>

                {/* Payee Detail Box */}
                <View style={styles.payeeDetailBox}>
                  <View style={styles.payeeRow}>
                    <Text style={styles.payeeRowLabel}>PAYEE NAME</Text>
                    <Text style={styles.payeeRowValue}>
                      {parsed.upi.pn || "Individual / Merchant"}
                    </Text>
                  </View>
                  <View style={styles.payeeRow}>
                    <Text style={styles.payeeRowLabel}>UPI VPA</Text>
                    <Text style={styles.payeeVpaValue}>{parsed.upi.pa}</Text>
                  </View>
                  {parsed.upi.tn ? (
                    <View style={styles.payeeRow}>
                      <Text style={styles.payeeRowLabel}>NOTE</Text>
                      <Text style={styles.payeeRowValue}>{parsed.upi.tn}</Text>
                    </View>
                  ) : null}
                </View>

                {/* QR Code Canvas with Scan Frame */}
                <View style={styles.qrFrameWrapper}>
                  <View style={styles.qrContainer}>
                    <QRCode
                      value={parsed.link}
                      size={190}
                      color="#02070A"
                      backgroundColor="#ffffff"
                    />
                  </View>
                  <Text style={styles.qrCaption}>
                    Scan with Google Pay, PhonePe, or Paytm camera
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionGrid}>
                  <Pressable
                    onPress={copyUpiId}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      copiedId && styles.actionBtnActive,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <PixelIcon
                      name={copiedId ? "check" : "copy"}
                      size={15}
                      color={copiedId ? themeColors.cyan : themeColors.text}
                    />
                    <Text
                      style={[
                        type.button,
                        styles.actionBtnText,
                        copiedId && { color: themeColors.cyan },
                      ]}
                    >
                      {copiedId ? "COPIED VPA" : "COPY UPI ID"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={copyPaymentLink}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      copiedLink && styles.actionBtnActive,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <PixelIcon
                      name={copiedLink ? "check" : "qr"}
                      size={15}
                      color={copiedLink ? themeColors.cyan : themeColors.text}
                    />
                    <Text
                      style={[
                        type.button,
                        styles.actionBtnText,
                        copiedLink && { color: themeColors.cyan },
                      ]}
                    >
                      {copiedLink ? "COPIED URL" : "COPY UPI URL"}
                    </Text>
                  </Pressable>
                </View>

                {/* Primary Mobile App Launch */}
                {!isDesktopWeb && (
                  <Pressable
                    onPress={payWithUpi}
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                  >
                    <PixelIcon name="arrow-right" size={16} color={themeColors.cyanInk} />
                    <Text style={[type.button, { color: themeColors.cyanInk }]}>
                      TRY DIRECT UPI APP LAUNCH
                    </Text>
                  </Pressable>
                )}

                {/* Clear Step-by-Step Payment Instructions */}
                <View style={styles.howToPayBlock}>
                  <Text style={styles.howToPayTitle}>HOW TO COMPLETE PAYMENT</Text>
                  <View style={styles.stepRow}>
                    <Text style={styles.stepBadge}>1</Text>
                    <Text style={styles.stepDesc}>
                      {copiedId ? "UPI ID is copied!" : "Tap 'COPY UPI ID' above"}
                    </Text>
                  </View>
                  <View style={styles.stepRow}>
                    <Text style={styles.stepBadge}>2</Text>
                    <Text style={styles.stepDesc}>Open Google Pay, PhonePe, or Paytm</Text>
                  </View>
                  <View style={styles.stepRow}>
                    <Text style={styles.stepBadge}>3</Text>
                    <Text style={styles.stepDesc}>
                      Select "To UPI ID", paste, and confirm payment
                    </Text>
                  </View>
                </View>

                {isPersonalUpi(parsed.upi) ? (
                  <Text style={styles.npciNote}>
                    Note: NPCI guidelines restrict direct web browser deep-links for personal accounts.
                    Scanning the QR or pasting the UPI ID ensures full banking compatibility.
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* ============================================================== */}
        {/* TAB 2: CREATE SMS REQUEST FLOW                                */}
        {/* ============================================================== */}
        {activeTab === "create" && (
          <View style={styles.tabContent}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <PixelIcon name="send" size={18} color={themeColors.cyan} />
                  <Text style={styles.cardTitle}>CREATE PAYMENT SMS</Text>
                </View>
              </View>

              <Text style={styles.cardDesc}>
                Build an offline UPI request message. When copied and sent as a plain SMS, the recipient
                can tap the link to pay you via Google Pay, PhonePe, or Paytm.
              </Text>

              {/* Payee Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>PAYEE (MOBILE NUMBER OR UPI ID)</Text>
                <TextInput
                  value={payee}
                  onChangeText={setPayee}
                  placeholder="e.g. 9876543210 or yourname@okhdfc"
                  placeholderTextColor={themeColors.muted}
                  style={styles.input}
                />
                {payee.length > 0 && !mobileCheck.valid ? (
                  <Text style={styles.inputErrorText}>{mobileCheck.reason}</Text>
                ) : null}
              </View>

              {/* Amount Input & Preset Chips */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>AMOUNT (₹)</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0 (leave empty for open amount)"
                  placeholderTextColor={themeColors.muted}
                  keyboardType="numeric"
                  style={styles.input}
                />
                {amount.length > 0 && !amountCheck.valid ? (
                  <Text style={styles.inputErrorText}>{amountCheck.reason}</Text>
                ) : null}

                {/* Preset Chips */}
                <View style={styles.presetRow}>
                  {AMOUNT_PRESETS.map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => applyAmountPreset(p)}
                      style={({ pressed }) => [
                        styles.presetChip,
                        amount === String(p) && styles.presetChipActive,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          amount === String(p) && styles.presetChipTextActive,
                        ]}
                      >
                        ₹{p}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Note / Memo Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>NOTE (OPTIONAL)</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. dinner, rent, cab"
                  placeholderTextColor={themeColors.muted}
                  style={styles.input}
                />
              </View>

              {/* Live Output Section */}
              {smsText ? (
                <View style={styles.smsPreviewBox}>
                  <View style={styles.smsPreviewTop}>
                    <Text style={styles.smsPreviewTitle}>GENERATED SMS PAYLOAD</Text>
                    <Text style={styles.smsLengthBadge}>
                      {smsText.length} chars · 1 SMS
                    </Text>
                  </View>

                  <TextInput
                    value={smsText}
                    editable={false}
                    multiline
                    style={styles.smsPayloadText}
                  />

                  <View style={styles.smsButtonRow}>
                    <Pressable
                      onPress={handleCopySms}
                      style={({ pressed }) => [
                        styles.coralBtn,
                        { flex: 1 },
                        smsCopied && styles.btnActive,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <PixelIcon
                        name={smsCopied ? "check" : "copy"}
                        size={15}
                        color={themeColors.coralInk}
                      />
                      <Text style={[type.button, { color: themeColors.coralInk }]}>
                        {smsCopied ? "COPIED TO CLIPBOARD" : "COPY SMS MESSAGE"}
                      </Text>
                    </Pressable>

                    {!isDesktopWeb && (
                      <Pressable
                        onPress={handleOpenSmsApp}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          { minHeight: 46 },
                          pressed && styles.btnPressed,
                        ]}
                      >
                        <PixelIcon name="message-text" size={15} color={themeColors.text} />
                        <Text style={[type.button, styles.actionBtnText]}>
                          SEND IN APP
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={createSms}
                  disabled={!mobileCheck.valid || !amountReady}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (!mobileCheck.valid || !amountReady) && styles.btnDisabled,
                    pressed && mobileCheck.valid && amountReady && styles.btnPressed,
                  ]}
                >
                  <PixelIcon
                    name="arrow-right"
                    size={16}
                    color={!mobileCheck.valid || !amountReady ? themeColors.muted : themeColors.cyanInk}
                  />
                  <Text
                    style={[
                      type.button,
                      { color: !mobileCheck.valid || !amountReady ? themeColors.muted : themeColors.cyanInk },
                    ]}
                  >
                    BUILD SMS PAYLOAD
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Security / Privacy Trust Floor */}
        <View style={styles.trustFloor}>
          <PixelIcon name="shield" size={14} color={themeColors.cyan} />
          <Text style={styles.trustText}>
            100% Client-Side. No bank credentials, phone numbers, or amounts are sent to any server.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: themeColors.bg,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.line,
    backgroundColor: "rgba(2, 7, 10, 0.96)",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radiusSm,
    backgroundColor: themeColors.panel,
    cursor: "pointer",
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  webTag: {
    backgroundColor: "rgba(2, 151, 222, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(2, 151, 222, 0.35)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusSm,
  },
  webTagText: {
    color: themeColors.cyan,
    fontSize: 10,
    letterSpacing: 1,
  },
  apkNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radiusSm,
    backgroundColor: themeColors.panel,
    cursor: "pointer",
  },

  scrollContainer: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
  },

  // Segmented Tab Controls
  tabBar: {
    flexDirection: "row",
    backgroundColor: themeColors.panel,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radius,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: 10,
    borderRadius: radiusSm,
    cursor: "pointer",
  },
  tabItemActive: {
    backgroundColor: themeColors.cyan,
  },
  tabText: {
    fontSize: 12,
    letterSpacing: 1,
  },
  tabContent: {
    gap: space.md,
  },

  // Card Structure
  card: {
    backgroundColor: themeColors.panel,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radiusLg,
    padding: space.lg,
    gap: space.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  cardTitle: {
    fontFamily: fonts.pixel,
    fontSize: 13,
    letterSpacing: 1,
    color: themeColors.text,
  },
  cardDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: themeColors.muted,
    lineHeight: 19,
  },

  miniActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(2, 151, 222, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(2, 151, 222, 0.35)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radiusSm,
    cursor: "pointer",
  },
  miniActionText: {
    fontFamily: fonts.pixel,
    fontSize: 10,
    color: themeColors.cyan,
    letterSpacing: 1,
  },

  textArea: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radius,
    padding: space.md,
    backgroundColor: themeColors.bg,
    color: themeColors.text,
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlignVertical: "top",
  },

  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: "rgba(255, 92, 92, 0.12)",
    borderWidth: 1,
    borderColor: themeColors.danger,
    padding: space.sm,
    borderRadius: radiusSm,
  },
  errorNoticeText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: themeColors.danger,
  },

  validPreviewNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: "rgba(2, 151, 222, 0.1)",
    borderWidth: 1,
    borderColor: themeColors.cyan,
    padding: space.sm,
    borderRadius: radiusSm,
  },
  validPreviewText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: themeColors.cyan,
  },

  // Buttons
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: themeColors.cyan,
    minHeight: 46,
    borderRadius: radius,
    paddingHorizontal: space.lg,
    cursor: "pointer",
  },
  coralBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: themeColors.coral,
    minHeight: 46,
    borderRadius: radius,
    paddingHorizontal: space.lg,
    cursor: "pointer",
  },
  btnDisabled: {
    backgroundColor: themeColors.line,
    opacity: 0.5,
    cursor: "not-allowed",
  },
  btnPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  btnActive: {
    backgroundColor: "#22c55e",
  },

  // Invoice Card Structure
  invoiceCard: {
    backgroundColor: themeColors.panel,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radiusLg,
    padding: space.lg,
    gap: space.lg,
  },
  invoiceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(252, 115, 77, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(252, 115, 77, 0.35)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 9999,
  },
  statusPillText: {
    fontFamily: fonts.pixel,
    fontSize: 10,
    letterSpacing: 1,
    color: themeColors.coral,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radiusSm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    cursor: "pointer",
  },
  resetBtnText: {
    fontFamily: fonts.pixel,
    fontSize: 10,
    letterSpacing: 1,
    color: themeColors.muted,
  },

  amountDisplayBlock: {
    alignItems: "center",
    paddingVertical: space.sm,
  },
  amountLabel: {
    fontFamily: fonts.pixel,
    fontSize: 11,
    letterSpacing: 1,
    color: themeColors.muted,
    marginBottom: 4,
  },
  amountNumber: {
    fontFamily: fonts.semibold,
    fontSize: 38,
    color: themeColors.coral,
    fontVariant: ["tabular-nums"],
  },

  payeeDetailBox: {
    backgroundColor: themeColors.bg,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radius,
    padding: space.md,
    gap: space.sm,
  },
  payeeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  payeeRowLabel: {
    fontFamily: fonts.pixel,
    fontSize: 10,
    letterSpacing: 1,
    color: themeColors.muted,
  },
  payeeRowValue: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: themeColors.text,
  },
  payeeVpaValue: {
    fontFamily: "monospace",
    fontSize: 13,
    color: themeColors.cyan,
  },

  qrFrameWrapper: {
    alignItems: "center",
    gap: space.sm,
  },
  qrContainer: {
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: radiusLg,
    borderWidth: 1,
    borderColor: themeColors.line,
  },
  qrCaption: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: themeColors.muted,
    textAlign: "center",
  },

  actionGrid: {
    flexDirection: "row",
    gap: space.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: themeColors.bg,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radius,
    minHeight: 44,
    paddingHorizontal: space.sm,
    cursor: "pointer",
  },
  actionBtnActive: {
    borderColor: themeColors.cyan,
    backgroundColor: "rgba(2, 151, 222, 0.12)",
  },
  actionBtnText: {
    fontSize: 12,
    letterSpacing: 1,
    color: themeColors.text,
  },

  howToPayBlock: {
    backgroundColor: themeColors.bg,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radius,
    padding: space.md,
    gap: space.sm,
  },
  howToPayTitle: {
    fontFamily: fonts.pixel,
    fontSize: 10,
    letterSpacing: 1,
    color: themeColors.cyan,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  stepBadge: {
    fontFamily: fonts.pixel,
    fontSize: 10,
    color: themeColors.cyan,
    backgroundColor: "rgba(2, 151, 222, 0.15)",
    width: 20,
    height: 20,
    lineHeight: 20,
    textAlign: "center",
    borderRadius: radiusSm,
  },
  stepDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: themeColors.text,
    flex: 1,
  },
  npciNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: themeColors.muted,
    lineHeight: 16,
    textAlign: "center",
  },

  // Field Groups for Create Request
  fieldGroup: {
    gap: space.xs,
  },
  fieldLabel: {
    fontFamily: fonts.pixel,
    fontSize: 11,
    letterSpacing: 1,
    color: themeColors.muted,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radius,
    paddingHorizontal: space.md,
    backgroundColor: themeColors.bg,
    color: themeColors.text,
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  inputErrorText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: themeColors.danger,
    marginTop: 2,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  presetChip: {
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radiusSm,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: themeColors.bg,
    cursor: "pointer",
  },
  presetChipActive: {
    borderColor: themeColors.cyan,
    backgroundColor: "rgba(2, 151, 222, 0.15)",
  },
  presetChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: themeColors.muted,
  },
  presetChipTextActive: {
    color: themeColors.cyan,
  },

  // SMS Preview Output
  smsPreviewBox: {
    backgroundColor: themeColors.bg,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radius,
    padding: space.md,
    gap: space.sm,
    marginTop: space.xs,
  },
  smsPreviewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  smsPreviewTitle: {
    fontFamily: fonts.pixel,
    fontSize: 10,
    letterSpacing: 1,
    color: themeColors.coral,
  },
  smsLengthBadge: {
    fontFamily: "monospace",
    fontSize: 11,
    color: themeColors.muted,
  },
  smsPayloadText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: themeColors.text,
    backgroundColor: themeColors.panel,
    borderWidth: 1,
    borderColor: themeColors.line,
    borderRadius: radiusSm,
    padding: space.sm,
    minHeight: 56,
  },
  smsButtonRow: {
    flexDirection: "row",
    gap: space.sm,
  },

  trustFloor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingTop: space.sm,
  },
  trustText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: themeColors.muted,
    textAlign: "center",
  },
});
