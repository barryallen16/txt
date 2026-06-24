import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { router } from "expo-router";
import AppButton from "../../components/AppButton";
import AppHeader from "../../components/AppHeader";
import PixelIcon from "../../components/PixelIcon";
import RecipientPicker from "../../components/RecipientPicker";
import { formatAge, newSessionId } from "../../lib/geo";
import { requestLocationAccess, shareLocation } from "../../lib/locationShare";
import { ensureSendPermission } from "../../lib/sms";
import { colors, radius, space, type } from "../../lib/theme";
import { withTimeout } from "../../lib/timeout";

const FIX_TIMEOUT_MS = 20_000;

export default function CurrentLocationScreen() {
  const [recipient, setRecipient] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);

  const send = async () => {
    if (!recipient?.number || sending) return;

    setSending(true);
    setError(null);
    setSent(null);

    try {
      // This asks Android to turn location on with its own dialog when the
      // switch is off, instead of failing quietly.
      const access = await requestLocationAccess({ background: false });
      if (!access.granted) {
        setError(access.reason);
        return;
      }

      if (!(await ensureSendPermission())) {
        setError("SMS permission is needed to send your location.");
        return;
      }

      const current = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        FIX_TIMEOUT_MS,
        null,
      );

      if (!current?.coords) {
        setError("Could not get a fix. Move into the open and try again.");
        return;
      }

      const fix = {
        lat: current.coords.latitude,
        lon: current.coords.longitude,
        accuracy: current.coords.accuracy ?? 0,
        timestamp: current.timestamp || Date.now(),
      };

      const result = await shareLocation({
        address: recipient.number,
        session: newSessionId(),
        fix,
      });

      if (result.sent) {
        setSent({ fix, at: Date.now() });
      } else {
        setError(result.reason ?? "The message did not leave the phone.");
      }
    } catch (failure) {
      setError(failure?.message ?? "Could not send your location.");
    } finally {
      setSending(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/share");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <AppHeader title="Current location" onBack={goBack} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <PixelIcon
            name="location"
            size={24}
            color={sent ? colors.accent : colors.muted}
          />
          <Text style={[type.heading, styles.center]}>One pin, sent once</Text>
          <Text style={[type.muted, styles.center]}>
            Your contact gets one SMS with the coordinates. Nothing follows it.
          </Text>
        </View>

        <View style={styles.status}>
          <View style={styles.statusRow}>
            <PixelIcon name="location" size={16} color={colors.text} />
            <Text style={type.bodyMedium}>
              {sent ? "Location sent" : "Current position"}
            </Text>
          </View>

          {sent ? (
            <>
              <Text style={type.muted}>
                {sent.fix.lat.toFixed(5)}, {sent.fix.lon.toFixed(5)} · ±
                {Math.round(sent.fix.accuracy)} m
              </Text>
              <Text style={type.muted}>{formatAge(Date.now() - sent.at)}</Text>
            </>
          ) : (
            <Text style={type.muted}>
              The fix is read when you press send, not before.
            </Text>
          )}

          {error ? <Text style={[type.muted, styles.error]}>{error}</Text> : null}
        </View>

        <RecipientPicker
          selected={recipient}
          onSelect={setRecipient}
          disabled={sending}
        />

        <Text style={[type.muted, styles.note]}>
          One update costs one SMS. For a moving trail, use live location
          instead.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label={sending ? "Getting your location..." : "Send current location"}
          onPress={send}
          loading={sending}
          disabled={!recipient?.number}
        />
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
    gap: space.xl,
  },
  hero: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.lg,
  },
  center: {
    textAlign: "center",
  },
  status: {
    gap: space.sm,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  error: {
    color: colors.danger,
  },
  note: {
    paddingBottom: space.lg,
  },
  footer: {
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
