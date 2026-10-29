import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { router, useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import AppButton from "../../components/AppButton";
import AppHeader from "../../components/AppHeader";
import IconButton from "../../components/IconButton";
import PixelIcon from "../../components/PixelIcon";
import { getTransfer, listTransfers } from "../../lib/db";
import { formatAge, formatDistance } from "../../lib/geo";
import { buildTrail, decodeLocation } from "../../lib/geo";
import { classifyQr, summariseQr } from "../../lib/qr";
import { colors, radius, space, type } from "../../lib/theme";
import { formatClock } from "../../lib/time";
import { KIND } from "../../lib/transfer";
import {
  buildRequestLink,
  isPersonalUpi,
  parseUpiLink,
} from "../../lib/upi";
import { copyText } from "../../lib/clipboard";
import { useToast } from "../../components/Toast";

export default function TransferDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const transfer = useMemo(
    () => getTransfer(Number(id)) ?? null,
    [id],
  );
  const showToast = useToast();

  // Open the link byte-for-byte as it arrived - nothing is rewritten here.
  // buildRequestLink now only validates and reads the amount back.
  const upiParsed = useMemo(() => {
    if (!transfer || transfer.kind !== KIND.QR) return null;
    const parsed = parseUpiLink(transfer.payload ?? "");
    return parsed.valid ? parsed : null;
  }, [transfer]);

  const upiAmount = upiParsed
    ? buildRequestLink(transfer.payload).amount
    : null;

  const trail = useMemo(() => {
    if (!transfer || transfer.kind !== KIND.LOCATION) return null;

    const points = listTransfers()
      .filter(
        (item) =>
          item.kind === KIND.LOCATION &&
          item.sender === transfer.sender &&
          (item.session ?? "") === (transfer.session ?? ""),
      )
      .map((item) => decodeLocation(item.payload ?? ""))
      .filter(Boolean);

    return buildTrail(points);
  }, [transfer]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/transfers");
  };

  const savePicture = async () => {
    if (!transfer?.payload_b64 || saving) return;

    setSaving(true);

    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true).catch(
        () => null,
      );

      if (permission && permission.granted === false && !permission.canAskAgain) {
        Alert.alert(
          "Allow photo access",
          "Turn on photo access in settings so txt can save the picture.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Open settings",
              onPress: () => Linking.openSettings().catch(() => {}),
            },
          ],
        );
        return;
      }

      const path = `${FileSystem.cacheDirectory}txt-${transfer.id}-${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(path, transfer.payload_b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await MediaLibrary.saveToLibraryAsync(path);
      Alert.alert("Saved", "Picture saved to your gallery.");
    } catch (failure) {
      Alert.alert(
        "Could not save the picture",
        failure?.message ?? "Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!transfer) {
    return (
      <SafeAreaView style={styles.screen} edges={["bottom"]}>
        <AppHeader title="Item" onBack={goBack} />
        <View style={styles.empty}>
          <PixelIcon name="shield" size={24} color={colors.muted} />
          <Text style={[type.body, styles.center]}>
            That item is no longer stored.
          </Text>
          <AppButton label="Back to inbox" onPress={() => router.replace("/transfers")} />
        </View>
      </SafeAreaView>
    );
  }

  const openMaps = () => {
    if (!trail?.latest) return;
    const { lat, lon } = trail.latest;
    Linking.openURL(`geo:${lat},${lon}?q=${lat},${lon}`).catch(() => {});
  };

  const openUpiPayment = async (rawLink) => {
    try {
      await Linking.openURL(rawLink.trim());
    } catch {
      Alert.alert("Cannot open UPI", "No UPI app could open this request.");
    }
  };

  const copyUpiVpa = async () => {
    if (!upiParsed?.pa) return;
    const ok = await copyText(upiParsed.pa);
    showToast({
      message: ok
        ? `UPI ID ${upiParsed.pa} copied. Paste in Google Pay, PhonePe or Paytm.`
        : "Could not copy the UPI ID.",
      type: ok ? "info" : "danger",
    });
  };

  const copyUpiAmount = async () => {
    if (!upiAmount) return;
    const ok = await copyText(upiAmount);
    showToast({
      message: ok
        ? `Amount \u20B9${upiAmount} copied. Paste it in your UPI app.`
        : "Could not copy the amount.",
      type: ok ? "info" : "danger",
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <AppHeader title="Item" onBack={goBack} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.meta}>
          <Text style={type.label}>
            {transfer.direction === "sent" ? "SENT TO" : "FROM"}
          </Text>
          <Text style={type.bodyMedium}>
            {transfer.direction === "sent"
              ? transfer.recipient || "Unknown recipient"
              : transfer.sender || "Unknown sender"}
          </Text>
          <Text style={type.muted}>
            {formatClock(transfer.received_at)}
            {trail?.ageMs != null ? ` · ${formatAge(trail.ageMs)}` : ""}
          </Text>
        </View>

        {transfer.kind === KIND.IMAGE && transfer.payload_b64 ? (
          <View style={styles.imageBlock}>
            <Pressable
              onPress={() => setViewerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="View received picture full screen"
              style={({ pressed }) => [
                styles.imageBox,
                pressed && styles.imagePressed,
              ]}
            >
              <Image
                source={{ uri: `data:image/jpeg;base64,${transfer.payload_b64}` }}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel="Received picture"
              />
              <View pointerEvents="none" style={styles.expandBadge}>
                <PixelIcon name="expand" size={16} color={colors.text} />
              </View>
            </Pressable>

            <Text style={type.muted}>Tap the picture to view it full screen.</Text>

            <AppButton
              label={saving ? "Saving..." : "Save to phone"}
              icon="download"
              variant="outline"
              loading={saving}
              onPress={savePicture}
            />
          </View>
        ) : null}

        {transfer.kind === KIND.QR ? (
          <View style={styles.qrBlock}>
            <View style={styles.codeBox}>
              <QRCode
                value={String(transfer.payload ?? "")}
                size={220}
                color={colors.bg}
                backgroundColor="#ffffff"
              />
            </View>
            <Text style={type.label}>{classifyQr(transfer.payload).toUpperCase()}</Text>
            <Text style={[type.body, styles.wrap]}>
              {summariseQr(transfer.payload)}
            </Text>
            {upiParsed ? (
              <View style={styles.upiActionsBlock}>
                {isPersonalUpi(upiParsed) ? (
                  <View style={styles.upiNotice}>
                    <PixelIcon name="info" size={16} color={colors.accent} />
                    <Text style={[type.muted, styles.upiNoticeText]}>
                      NPCI restricts direct app links for personal accounts. Point another phone's camera at this QR code to pay, or copy the UPI ID below to pay from this device.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.upiButtons}>
                  <AppButton
                    label="Copy UPI ID"
                    icon="copy"
                    variant="primary"
                    onPress={copyUpiVpa}
                    style={styles.actionButton}
                  />
                  {upiAmount ? (
                    <AppButton
                      label={`Copy \u20B9${upiAmount}`}
                      icon="rupee"
                      variant="outline"
                      onPress={copyUpiAmount}
                      style={styles.actionButton}
                    />
                  ) : null}
                </View>

                <AppButton
                  label="Try direct UPI link"
                  icon="arrow-right"
                  variant="outline"
                  onPress={() => openUpiPayment(transfer.payload)}
                  style={styles.actionButton}
                />
              </View>

            ) : null}
          </View>
        ) : null}

        {transfer.kind === KIND.TEXT ? (
          <Text style={[type.body, styles.wrap]}>{transfer.payload}</Text>
        ) : null}

        {transfer.kind === KIND.LOCATION && trail ? (
          <View style={styles.locationBlock}>
            {trail.latest ? (
              <>
                <View style={styles.fixRow}>
                  <PixelIcon name="location" size={16} color={colors.text} />
                  <Text style={type.amountSmall}>
                    {trail.latest.lat.toFixed(5)}, {trail.latest.lon.toFixed(5)}
                  </Text>
                </View>

                <View style={styles.facts}>
                  <Fact label="FRESHNESS" value={formatAge(trail.ageMs)} />
                  <Fact label="PINGS" value={String(trail.points.length)} />
                  <Fact label="MOVED" value={formatDistance(trail.travelled)} />
                </View>

                {trail.stale ? (
                  <Text style={[type.muted, styles.warn]}>
                    No update lately. Treat this position as old.
                  </Text>
                ) : null}

                <AppButton label="Open in Maps" variant="outline" onPress={openMaps} />
              </>
            ) : (
              <Text style={type.muted}>No readable position in this message.</Text>
            )}

            <View style={styles.trail}>
              <Text style={type.label}>TRAIL</Text>
              {[...trail.points].reverse().map((point, index) => (
                <View key={`${point.timestamp}-${index}`} style={styles.pointRow}>
                  <Text style={type.muted}>{formatClock(point.timestamp)}</Text>
                  <Text style={[type.muted, styles.pointCoords]}>
                    {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
                  </Text>
                  <Text style={type.muted}>
                    ±{Math.round(point.accuracy ?? 0)} m
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerOpen(false)}
      >
        <View
          style={[
            styles.viewer,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.viewerBar}>
            <Text style={type.label}>PICTURE</Text>
            <IconButton
              icon="close"
              label="Close picture"
              onPress={() => setViewerOpen(false)}
            />
          </View>

          <Pressable
            onPress={() => setViewerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close picture"
            style={styles.viewerBody}
          >
            {transfer.payload_b64 ? (
              <Image
                source={{
                  uri: `data:image/jpeg;base64,${transfer.payload_b64}`,
                }}
                style={styles.viewerImage}
                resizeMode="contain"
                accessibilityLabel="Received picture full screen"
              />
            ) : null}
          </Pressable>

          <View style={styles.viewerFooter}>
            <AppButton
              label={saving ? "Saving..." : "Save to phone"}
              icon="download"
              variant="outline"
              loading={saving}
              onPress={savePicture}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Fact({ label, value }) {
  return (
    <View style={styles.fact}>
      <Text style={type.label}>{label}</Text>
      <Text style={type.bodyMedium}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: space.lg,
    gap: space.xl,
  },
  meta: {
    gap: 2,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  imageBlock: {
    gap: space.md,
  },
  imageBox: {
    height: 280,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  imagePressed: {
    opacity: 0.85,
  },
  image: {
    flex: 1,
  },
  expandBadge: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
    backgroundColor: "rgba(11, 12, 16, 0.8)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  viewer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.96)",
  },
  viewerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  viewerBody: {
    flex: 1,
    paddingHorizontal: space.md,
  },
  viewerImage: {
    flex: 1,
    width: "100%",
  },
  viewerFooter: {
    padding: space.lg,
  },
  qrBlock: {
    alignItems: "center",
    gap: space.md,
  },
  codeBox: {
    padding: space.lg,
    backgroundColor: "#ffffff",
    borderRadius: radius,
  },
  wrap: {
    flexWrap: "wrap",
  },
  actionButton: {
    alignSelf: "stretch",
    flex: 1,
  },
  upiActionsBlock: {
    alignSelf: "stretch",
    gap: space.sm,
    marginTop: space.sm,
  },
  upiButtons: {
    flexDirection: "row",
    gap: space.sm,
  },
  upiNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    padding: space.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
  },
  upiNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  locationBlock: {
    gap: space.md,
  },
  fixRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  facts: {
    flexDirection: "row",
    gap: space.sm,
  },
  fact: {
    flex: 1,
    gap: 2,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
  },
  warn: {
    color: colors.text,
  },
  trail: {
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  pointRow: {
    flexDirection: "row",
    gap: space.md,
  },
  pointCoords: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    padding: space.xl,
  },
  center: {
    textAlign: "center",
  },
});
