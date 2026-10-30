import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  DeviceEventEmitter,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import * as Notifications from "expo-notifications";
import RNAndroidNotificationListener from "react-native-android-notification-listener";
import AppButton from "../components/AppButton";
import AppHeader from "../components/AppHeader";
import IconButton from "../components/IconButton";
import Loading from "../components/Loading";
import PixelIcon from "../components/PixelIcon";
import { colors, fonts, radius, space, type } from "../lib/theme";
import {
  listHistoryRequests,
  listRequests,
  setRequestStatus,
  toDate,
} from "../lib/db";
import { syncInbox, INBOX_SYNCED_EVENT } from "../lib/syncInbox";
import { dayLabel } from "../lib/time";
import { copyText } from "../lib/clipboard";
import { isMerchantUpi, isPersonalUpi, normalizeAmount, parseUpiLink } from "../lib/upi";
import { useToast } from "../components/Toast";

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function withLinkFallback(row) {
  const parsed = parseUpiLink(row.upi_link || "");
  return {
    ...row,
    payee_name: row.payee_name || parsed.pn || null,
    payee_vpa: row.payee_vpa || parsed.pa || null,
    amount: normalizeAmount(row.amount) || normalizeAmount(parsed.am) || null,
  };
}

function timeOf(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SmsPaymentsScreen() {
  const showToast = useToast();
  const [tab, setTab] = useState("open");
  const [openRequests, setOpenRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationAccess, setNotificationAccess] = useState("checking");
  const [pushGranted, setPushGranted] = useState(true);
  const [askingPush, setAskingPush] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [payingDirectId, setPayingDirectId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [busy, setBusy] = useState(null);
  const [undo, setUndo] = useState(null);
  const [error, setError] = useState(null);

  const undoTimer = useRef(null);
  const copiedTimer = useRef(null);

  const readStored = useCallback(() => {
    try {
      setOpenRequests(listRequests("open").map(withLinkFallback));
      setHistory(listHistoryRequests().map(withLinkFallback));
      setError(null);
    } catch {
      setError("Could not read stored requests.");
    }
  }, []);

  const checkNotificationAccess = useCallback(async () => {
    try {
      const status = await RNAndroidNotificationListener.getPermissionStatus();
      setNotificationAccess(status === "authorized" ? "authorized" : "missing");
    } catch {
      setNotificationAccess("missing");
    }
  }, []);

  const load = useCallback(
    async (mode = "focus") => {
      if (mode === "refresh") setRefreshing(true);
      readStored();

      try {
        await syncInbox({ force: mode === "refresh" });
        readStored();
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [readStored],
  );

  useFocusEffect(
    useCallback(() => {
      load("focus");
      checkNotificationAccess();
    }, [load, checkNotificationAccess]),
  );

  // The background inbox poll can store a request while this screen is open.
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      INBOX_SYNCED_EVENT,
      readStored,
    );
    return () => subscription.remove();
  }, [readStored]);

  // Notification-listener access is granted in system settings. Re-check when
  // the user comes back to the app.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") checkNotificationAccess();
    });
    return () => subscription.remove();
  }, [checkNotificationAccess]);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  // Android 13+ needs POST_NOTIFICATIONS before a local notification can show.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    Notifications.getPermissionsAsync()
      .then(async (settings) => {
        if (settings.granted) return;
        if (!settings.canAskAgain) {
          setPushGranted(false);
          return;
        }
        const asked = await Notifications.requestPermissionsAsync();
        setPushGranted(asked.granted);
      })
      .catch(() => {});
  }, []);

  const sections = useMemo(() => {
    const rows = tab === "open" ? openRequests : history;
    const groups = new Map();

    for (const request of rows) {
      const received = toDate(request.received_at);
      const date =
        tab === "open"
          ? received
          : new Date(Number(request.handled_at) || received.getTime());
      const key = dayKey(date);
      if (!groups.has(key)) groups.set(key, { title: dayLabel(date), data: [] });
      groups.get(key).data.push({ ...request, date });
    }

    return [...groups.values()];
  }, [tab, openRequests, history]);

  // Copy the UPI ID and open the UPI app so the user can easily paste and pay.
  const copyAndOpen = async (item) => {
    const vpa = item.payee_vpa || parseUpiLink(item.upi_link || "").pa;
    if (!vpa) {
      showToast({ message: "No UPI ID found in this request.", type: "danger" });
      return;
    }

    const ok = await copyText(vpa);
    if (ok) {
      setCopiedKey(`pay:${item.id}`);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedKey(null), 1800);
      showToast({
        message: `UPI ID ${vpa} copied. Opening UPI app...`,
        type: "info",
      });
    }

    setError(null);
    setPayingId(item.id);
    try {
      // Open UPI app home page without payment parameters, so the user can paste the copied UPI ID
      await Linking.openURL("upi://pay");
    } catch {
      setError(
        ok
          ? "UPI ID was copied, but no UPI app could open automatically. Open your UPI app and paste the ID."
          : "No UPI app could open."
      );
    } finally {
      setPayingId(null);
    }
  };

  const payDirect = async (item) => {
    if (!item.upi_link) return;
    setError(null);
    setPayingDirectId(item.id);
    try {
      await Linking.openURL(item.upi_link);
    } catch {
      setError("No UPI app could open this direct link.");
    } finally {
      setPayingDirectId(null);
    }
  };

  const copyVpa = async (item) => {
    const vpa = item.payee_vpa || parseUpiLink(item.upi_link || "").pa;
    if (!vpa) return;
    const ok = await copyText(vpa);
    if (ok) {
      setCopiedKey(`vpa:${item.id}`);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedKey(null), 1800);
    }
    showToast({
      message: ok
        ? `UPI ID ${vpa} copied. Paste in Google Pay, PhonePe or Paytm.`
        : "Could not copy the UPI ID.",
      type: ok ? "info" : "danger",
    });
  };

  const copyAmount = async (item) => {
    if (!item.amount) return;
    const ok = await copyText(item.amount);
    if (ok) {
      setCopiedKey(`amt:${item.id}`);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedKey(null), 1800);
    }
    showToast({
      message: ok
        ? `Amount ₹${item.amount} copied. Paste it in your UPI app.`
        : "Could not copy the amount.",
      type: ok ? "info" : "danger",
    });
  };

  const handle = (item, status) => {
    setBusy(`${item.id}:${status}`);
    try {
      setRequestStatus(item.id, status);
      setUndo({ id: item.id, previous: item.status || "open" });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), 6000);
      readStored();
    } catch {
      setError("Could not update that request.");
    } finally {
      setBusy(null);
    }
  };

  const undoLast = () => {
    if (!undo) return;
    try {
      setRequestStatus(undo.id, undo.previous);
      readStored();
      if (undo.previous === "open") setTab("open");
      showToast({ message: "Request restored to open.", type: "info" });
    } catch {
      setError("Could not undo that change.");
    }
    setUndo(null);
  };

  const reopen = (item) => {
    try {
      setRequestStatus(item.id, "open");
      readStored();
      setTab("open");
      showToast({ message: "Request moved back to open.", type: "info" });
    } catch {
      setError("Could not reopen that request.");
    }
  };

  const askPush = async () => {
    setAskingPush(true);
    try {
      const asked = await Notifications.requestPermissionsAsync();
      setPushGranted(asked.granted);
    } catch {
      // Leave the bar in place so the user can try again.
    } finally {
      setAskingPush(false);
    }
  };

  const allowNotificationAccess = () => {
    setNotificationAccess("checking");
    try {
      RNAndroidNotificationListener.requestPermission();
    } catch {
      setNotificationAccess("missing");
      setError("Could not open the notification access settings.");
    }
  };

  const rows = tab === "open" ? openRequests : history;
  const showLoading = loading && rows.length === 0;

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <AppHeader
        title="Requests"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        right={
          refreshing ? (
            <ActivityIndicator color={colors.muted} style={styles.headerSpinner} />
          ) : (
            <IconButton
              icon="reload"
              label="Refresh requests"
              onPress={() => load("refresh")}
            />
          )
        }
      />

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab("open")}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "open" }}
          style={[styles.tab, tab === "open" && styles.tabActive]}
        >
          <Text style={[type.label, tab === "open" && styles.tabActiveText]}>
            OPEN{openRequests.length > 0 ? ` ${openRequests.length}` : ""}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("history")}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "history" }}
          style={[styles.tab, tab === "history" && styles.tabActive]}
        >
          <Text style={[type.label, tab === "history" && styles.tabActiveText]}>
            HISTORY{history.length > 0 ? ` ${history.length}` : ""}
          </Text>
        </Pressable>
      </View>

      {Platform.OS === "android" && notificationAccess !== "authorized" ? (
        <View style={styles.accessCard}>
          <View style={styles.accessText}>
            <PixelIcon name="bell" size={24} color={colors.muted} />
            <Text style={type.bodyMedium}>Notification access is off</Text>
            <Text style={type.muted}>
              Allow access so incoming SMS requests can be read while the app is
              closed.
            </Text>
          </View>
          <AppButton
            label={
              notificationAccess === "checking" ? "Checking" : "Allow access"
            }
            variant={rows.length === 0 ? "primary" : "outline"}
            loading={notificationAccess === "checking"}
            onPress={allowNotificationAccess}
          />
        </View>
      ) : null}

      {!pushGranted ? (
        <View style={styles.pushBar}>
          <Text style={[type.muted, styles.pushText]}>
            Notifications are off. New requests still appear here.
          </Text>
          <AppButton
            label="Allow"
            variant="outline"
            loading={askingPush}
            onPress={askPush}
            style={styles.pushButton}
          />
        </View>
      ) : null}

      {undo ? (
        <View style={styles.undoBar}>
          <Text style={[type.muted, styles.undoText]}>
            Request moved to history.
          </Text>
          <Pressable
            onPress={undoLast}
            accessibilityRole="button"
            accessibilityLabel="Undo moving the request"
            hitSlop={8}
          >
            <Text style={type.label}>UNDO</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <Text style={[type.muted, styles.error]}>{error}</Text>
      ) : null}

      {showLoading ? (
        <Loading label="Loading requests" style={styles.fill} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh")}
              tintColor={colors.muted}
              colors={[colors.accent]}
            />
          }
          renderSectionHeader={({ section }) => (
            <Text style={[type.label, styles.sectionHeader]}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => {
            const handled = tab === "history";
            const paying = payingId === item.id;
            const payingDirect = payingDirectId === item.id;
            const working = busy != null;
            const isPersonal = isPersonalUpi(item.upi_link || "");
            const isMerchant = isMerchantUpi(item.upi_link || "");

            const isPayCopied = copiedKey === `pay:${item.id}`;
            const isAmtCopied = copiedKey === `amt:${item.id}`;
            const isVpaCopied = copiedKey === `vpa:${item.id}`;

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.amountBlock}>
                    <Text style={type.label}>MONEY REQUESTED</Text>
                    <Text style={styles.prominentAmount} numberOfLines={1}>
                      {item.amount ? `₹${item.amount}` : "No amount set"}
                    </Text>
                  </View>
                  <View style={styles.payeeInfo}>
                    <Text style={type.label}>PAYEE</Text>
                    <Text style={[type.bodyMedium, styles.payeeName]} numberOfLines={1}>
                      {item.payee_name || "Unknown payee"}
                    </Text>
                  </View>
                </View>

                <View style={styles.vpaRow}>
                  <Text style={[type.muted, styles.vpaText]} numberOfLines={1}>
                    {item.payee_vpa ? `UPI ID: ${item.payee_vpa}` : "No VPA"}
                  </Text>
                  {item.payee_vpa ? (
                    <Pressable
                      onPress={() => copyVpa(item)}
                      accessibilityRole="button"
                      accessibilityLabel="Copy UPI ID"
                      hitSlop={6}
                      style={[styles.vpaCopyChip, isVpaCopied && styles.vpaCopyChipActive]}
                    >
                      <PixelIcon
                        name="copy"
                        size={12}
                        color={isVpaCopied ? colors.accentInk : colors.accent}
                      />
                      <Text style={[styles.vpaCopyText, isVpaCopied && styles.vpaCopyTextActive]}>
                        {isVpaCopied ? "Copied" : "Copy"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.meta}>
                  <Text style={type.muted} numberOfLines={1}>
                    {item.sender ? `From ${item.sender}` : "Unknown sender"}
                  </Text>
                  <Text style={type.muted}>
                    {timeOf(item.date)}
                    {handled ? ` · ${dayLabel(item.date)}` : ""}
                  </Text>
                </View>

                {handled ? (
                  <View style={styles.handledRow}>
                    <View style={styles.badge}>
                      <Text style={type.label}>
                        {item.status === "dismissed" ? "DISMISSED" : "DONE"}
                      </Text>
                    </View>
                    <AppButton
                      label="Reopen"
                      variant="outline"
                      onPress={() => reopen(item)}
                      style={styles.reopenButton}
                    />
                  </View>
                ) : (
                  <>
                    <View style={styles.actions}>
                      <AppButton
                        label={
                          isPayCopied
                            ? "Copied! Opening UPI..."
                            : paying
                              ? "Opening UPI..."
                              : "Copy UPI ID & open app"
                        }
                        icon="arrow-right"
                        variant="primary"
                        loading={paying}
                        disabled={working || !item.payee_vpa}
                        onPress={() => copyAndOpen(item)}
                        style={styles.actionButton}
                      />
                    </View>

                    {item.amount || isMerchant ? (
                      <View style={styles.actions}>
                        {item.amount ? (
                          <AppButton
                            label={isAmtCopied ? "Copied" : `Copy \u20B9${item.amount}`}
                            icon="rupee"
                            variant="outline"
                            disabled={working || paying || payingDirect}
                            onPress={() => copyAmount(item)}
                            style={styles.actionButton}
                          />
                        ) : null}
                        {isMerchant ? (
                          <AppButton
                            label={payingDirect ? "Opening UPI..." : "Try direct UPI link"}
                            icon="arrow-right"
                            variant="outline"
                            loading={payingDirect}
                            disabled={working || paying || !item.upi_link}
                            onPress={() => payDirect(item)}
                            style={styles.actionButton}
                          />
                        ) : null}
                      </View>
                    ) : null}

                    <Text style={[type.muted, styles.payHint]}>
                      {isPersonal
                        ? "NPCI restricts direct links for personal accounts. The UPI ID is copied so you can paste it in your UPI app."
                        : "Merchant request verified. You can use direct link or copy details to pay."}
                    </Text>

                    <View style={styles.actions}>
                      <AppButton
                        label="Mark done"
                        icon="check"
                        variant="outline"
                        loading={busy === `${item.id}:done`}
                        disabled={working || paying || payingDirect}
                        onPress={() => handle(item, "done")}
                        style={styles.actionButton}
                      />
                      <AppButton
                        label="Dismiss"
                        icon="close"
                        variant="ghost"
                        loading={busy === `${item.id}:dismissed`}
                        disabled={working || paying || payingDirect}
                        onPress={() => handle(item, "dismissed")}
                        style={styles.actionButton}
                      />
                    </View>
                  </>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <PixelIcon
                name={tab === "open" ? "message-text" : "clock"}
                size={24}
                color={colors.muted}
              />
              <Text style={[type.body, styles.centerText]}>
                {tab === "open" ? "No open requests" : "Nothing in history yet"}
              </Text>
              <Text style={[type.muted, styles.centerText]}>
                {tab === "open"
                  ? "A request arrives when an SMS contains a :txt UPI link. The app checks messages on this phone every few seconds."
                  : "Mark a request done or dismiss it, and it lands here."}
              </Text>
            </View>
          }
        />
      )}
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
  tabs: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
  },
  tabActive: {
    backgroundColor: colors.panel,
    borderColor: colors.text,
  },
  tabActiveText: {
    color: colors.text,
  },
  accessCard: {
    margin: space.lg,
    marginBottom: 0,
    padding: space.lg,
    gap: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
  },
  accessText: {
    gap: space.sm,
  },
  pushBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginHorizontal: space.lg,
    marginTop: space.md,
  },
  pushText: {
    flex: 1,
  },
  pushButton: {
    minHeight: 40,
    paddingHorizontal: space.md,
  },
  undoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
  },
  undoText: {
    flex: 1,
  },
  error: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    color: colors.danger,
  },
  list: {
    padding: space.lg,
    paddingBottom: space.xxl,
  },
  sectionHeader: {
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  card: {
    gap: space.sm,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
    marginBottom: space.md,
  },
  cardHeader: {
    gap: space.xs,
    paddingBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  amountBlock: {
    gap: 2,
    marginBottom: 4,
  },
  prominentAmount: {
    fontFamily: fonts.semibold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  payeeInfo: {
    gap: 2,
  },
  payeeName: {
    fontSize: 16,
    color: colors.text,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xs,
  },
  actionButton: {
    flex: 1,
  },
  payHint: {
    marginTop: space.xs,
  },
  vpaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  vpaText: {
    flexShrink: 1,
  },
  vpaCopyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
  },
  vpaCopyChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  vpaCopyText: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.accent,
    textTransform: "uppercase",
  },
  vpaCopyTextActive: {
    color: colors.accentInk,
  },
  handledRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.sm,
  },
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
  },
  reopenButton: {
    minHeight: 40,
    marginLeft: "auto",
    paddingHorizontal: space.md,
  },
  empty: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xxl,
  },
  centerText: {
    textAlign: "center",
  },
});
