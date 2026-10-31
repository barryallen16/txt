import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AppButton from "../components/AppButton";
import AppHeader from "../components/AppHeader";
import IconButton from "../components/IconButton";
import Loading from "../components/Loading";
import PixelIcon from "../components/PixelIcon";
import { getMeta, setMeta } from "../lib/db";
import {
  DEFAULT_SNAPSHOT,
  getPermissionSnapshot,
  needsSetup,
  openAppSettings,
  requestCameraAccess,
  requestContactsAccess,
  requestLocationAccess,
  requestNotificationAccess,
  requestNotificationListenerAccess,
  requestSmsAccess,
} from "../lib/permissions";
import { colors, radius, space, type } from "../lib/theme";

function readFirstRun() {
  try {
    return getMeta("onboarding_complete") !== "1";
  } catch {
    return false;
  }
}

export default function PermissionsScreen() {
  if (Platform.OS === "web") {
    router.replace("/web");
    return null;
  }

  const [firstRun] = useState(readFirstRun);
  const [snapshot, setSnapshot] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    setError(null);
    let next = null;

    try {
      next = await getPermissionSnapshot();
      setSnapshot(next);
    } catch {
      // The contract says this cannot throw, but never leave the screen on a
      // spinner if a future native change breaks that promise.
      next = { ...DEFAULT_SNAPSHOT };
      setSnapshot(next);
      setError("Could not read the permission state. Try again.");
    } finally {
      setChecking(false);
    }

    return next;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Notification-listener access is granted in system settings, so the state
  // is only known once the app comes back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const finish = () => {
    try {
      setMeta("onboarding_complete", "1");
    } catch {
      // The flag is only a convenience; do not trap the user on this screen.
    }

    if (firstRun || !router.canGoBack()) router.replace("/");
    else router.back();
  };

  const allow = async (key) => {
    setBusy(key);
    setError(null);

    let granted = false;

    try {
      if (key === "notificationListener") {
        requestNotificationListenerAccess();
        return;
      }
      if (key === "sms") granted = await requestSmsAccess();
      if (key === "notifications") granted = await requestNotificationAccess();
      if (key === "contacts") granted = await requestContactsAccess();
      if (key === "camera") granted = await requestCameraAccess();
      if (key === "location") granted = await requestLocationAccess();
    } catch {
      setError("Android did not show that permission prompt. Open Settings.");
    } finally {
      setBusy(null);
    }

    const next = await refresh();
    if (!next) return;

    const stillOff =
      key === "notificationListener"
        ? next.notificationListener !== "authorized"
        : !next[key];

    if (!granted || stillOff) {
      Alert.alert(
        "Permission is still off",
        "Android did not grant access. Turn it on in the app settings.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open settings", onPress: openAppSettings },
        ],
      );
    }
  };

  const rows = snapshot
    ? [
        Platform.OS === "android"
          ? {
              key: "notificationListener",
              icon: "bell",
              title: "Background notification reader",
              detail:
                "Listens for incoming txt alerts while the app is closed so you get instant popups.",
              granted: snapshot.notificationListener === "authorized",
              actionLabel: "Open settings",
              settingsLink: false,
            }
          : null,
        Platform.OS === "android"
          ? {
              key: "sms",
              icon: "message-text",
              title: "SMS inbox & direct send",
              detail:
                "Reads SMS inbox so swiped or missed payment requests and pictures load reliably, and sends transfers.",
              granted: snapshot.sms,
              actionLabel: "Allow messages",
              settingsLink: true,
            }
          : null,
        {
          key: "notifications",
          icon: "inbox",
          title: "Show new item alerts",
          detail:
            "Android 13 and newer need this before txt can post a notification.",
          granted: snapshot.notifications,
          actionLabel: "Allow alerts",
          settingsLink: true,
        },
        {
          key: "contacts",
          icon: "user",
          title: "Pick from contacts",
          detail:
            "Used to choose who gets a request and to keep favorite contacts.",
          granted: snapshot.contacts,
          actionLabel: "Allow contacts",
          settingsLink: true,
        },
        {
          key: "camera",
          icon: "qr",
          title: "Scan QR codes",
          detail: "The camera only reads a code when you point it at one.",
          granted: snapshot.camera,
          actionLabel: "Allow camera",
          settingsLink: true,
        },
        {
          key: "location",
          icon: "location",
          title: "Share live location",
          detail:
            "Only read while a location share is running. You choose when to start.",
          granted: snapshot.location,
          actionLabel: "Allow location",
          settingsLink: true,
        },
      ].filter(Boolean)
    : [];

  const warning = snapshot && needsSetup(snapshot);

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <AppHeader
        title={firstRun ? "Welcome" : "Permissions"}
        onBack={
          firstRun
            ? undefined
            : () => (router.canGoBack() ? router.back() : router.replace("/"))
        }
        right={
          checking ? (
            <ActivityIndicator color={colors.muted} style={styles.headerSpinner} />
          ) : (
            <IconButton
              icon="reload"
              label="Check permissions again"
              onPress={refresh}
            />
          )
        }
      />

      {snapshot == null && checking ? (
        <Loading label="Checking permissions" style={styles.fill} />
      ) : snapshot == null ? (
        <View style={styles.errorState}>
          <PixelIcon name="shield" size={24} color={colors.muted} />
          <Text style={[type.body, styles.center]}>
            Could not read the permission state.
          </Text>
          <Text style={[type.muted, styles.center]}>
            Retry, or open Android settings and check access by hand.
          </Text>
          <AppButton label="Retry" onPress={refresh} />
          <AppButton
            label="Open settings"
            variant="outline"
            onPress={openAppSettings}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.intro}>
            {firstRun ? (
              <Image
                source={require("../assets/txt-s500.png")}
                style={styles.logo}
                accessibilityLabel="txt"
              />
            ) : (
              <PixelIcon name="shield" size={24} color={colors.text} />
            )}
            <Text style={[type.heading, styles.center]}>
              {firstRun ? "Set up txt" : "Permissions"}
            </Text>
            <Text style={[type.muted, styles.center]}>
              {firstRun
                ? "A few system permissions are needed before incoming messages can be read and shared items can arrive."
                : "Fix anything that is off. The home screen shows this again when a required permission is missing."}
            </Text>
            {firstRun ? (
              <Text style={[type.muted, styles.center]}>
                By continuing you agree to the{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => router.push("/legal")}
                >
                  TERMS
                </Text>
              </Text>
            ) : null}
          </View>

          {rows.map((row) => (
            <View key={row.key} style={styles.card}>
              <View style={styles.cardTop}>
                <PixelIcon
                  name={row.icon}
                  size={20}
                  color={row.granted ? colors.text : colors.muted}
                />
                <View style={styles.cardText}>
                  <Text style={type.bodyMedium}>{row.title}</Text>
                  <Text style={type.muted}>{row.detail}</Text>
                </View>
                {row.granted ? (
                  <PixelIcon name="check" size={16} color={colors.accent} />
                ) : (
                  <Text style={type.label}>OFF</Text>
                )}
              </View>

              {!row.granted ? (
                <View style={styles.cardActions}>
                  <AppButton
                    label={row.actionLabel}
                    variant="outline"
                    loading={busy === row.key}
                    onPress={() => allow(row.key)}
                    style={styles.actionButton}
                  />
                  {row.settingsLink ? (
                    <Pressable
                      onPress={openAppSettings}
                      accessibilityRole="button"
                      accessibilityLabel={`Open settings for ${row.title}`}
                      hitSlop={8}
                    >
                      <Text style={[type.label, styles.settingsLink]}>
                        SETTINGS
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {!row.granted && row.key === "notificationListener" ? (
                <Pressable
                  onPress={() => Linking.openURL("https://txt.runs-on.dev/#guide-restricted")}
                  accessibilityRole="link"
                  accessibilityLabel="View installation guide for restricted settings"
                  hitSlop={8}
                  style={styles.guideHelpRow}
                >
                  <PixelIcon name="info" size={13} color={colors.accent} />
                  <Text style={[type.label, styles.guideHelpText]}>
                    BLOCKED BY RESTRICTED SETTINGS? SEE GUIDE
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          {error ? <Text style={[type.muted, styles.error]}>{error}</Text> : null}

          {warning ? (
            <View style={styles.warning}>
              <PixelIcon name="shield" size={16} color={colors.text} />
              <Text style={[type.muted, styles.warningText]}>
                Message and notification access are still off, so incoming
                requests will not appear on their own. You can finish this later
                from the shield on the home screen.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <AppButton
          label={firstRun ? "Start using txt" : "Done"}
          onPress={finish}
        />
        {firstRun ? (
          <Pressable
            onPress={finish}
            accessibilityRole="button"
            accessibilityLabel="Skip permission setup"
            hitSlop={8}
            style={styles.skip}
          >
            <Text style={type.label}>SKIP FOR NOW</Text>
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
  fill: {
    flex: 1,
  },
  headerSpinner: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
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
  termsLink: {
    color: colors.accent,
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
  },
  card: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  actionButton: {
    flex: 1,
  },
  settingsLink: {
    paddingVertical: space.sm,
  },
  error: {
    color: colors.danger,
  },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
  },
  warningText: {
    flex: 1,
  },
  footer: {
    padding: space.lg,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  skip: {
    alignItems: "center",
    paddingVertical: space.sm,
  },
  guideHelpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingTop: space.xs,
  },
  guideHelpText: {
    color: colors.accent,
    fontSize: 11,
  },
});
