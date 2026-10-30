import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import AppButton from "../components/AppButton";
import AppHeader from "../components/AppHeader";
import IconButton from "../components/IconButton";
import Loading from "../components/Loading";
import PixelIcon from "../components/PixelIcon";
import {
  getMissingPartIndices,
  listPendingTransfers,
  listTransfers,
} from "../lib/db";
import { buildTrail, formatAge } from "../lib/geo";
import { decodeLocation } from "../lib/geo";
import { summariseQr } from "../lib/qr";
import { syncInbox, INBOX_SYNCED_EVENT } from "../lib/syncInbox";
import { colors, radius, radiusLg, radiusSm, space, type } from "../lib/theme";
import { dayLabel, formatClock } from "../lib/time";
import { KIND } from "../lib/transfer";

const LABEL = {
  [KIND.TEXT]: "MESSAGE",
  [KIND.QR]: "QR CODE",
  [KIND.LOCATION]: "LOCATION",
  [KIND.IMAGE]: "PICTURE",
};

const ICON = {
  [KIND.TEXT]: "message-text",
  [KIND.QR]: "qr",
  [KIND.LOCATION]: "location",
  [KIND.IMAGE]: "image",
};

const NOUN = {
  [KIND.TEXT]: "message",
  [KIND.QR]: "QR code",
  [KIND.LOCATION]: "location",
  [KIND.IMAGE]: "picture",
};

function preview(item) {
  if (item.kind === KIND.QR) return summariseQr(item.payload);
  if (item.kind === KIND.TEXT) {
    return String(item.payload ?? "").slice(0, 80);
  }
  if (item.kind === KIND.IMAGE) {
    return item.payload_b64 ? "Tap to open the picture" : "Empty picture";
  }
  if (item.kind === KIND.LOCATION) {
    return null;
  }
  return String(item.payload ?? "");
}

function locationLine(item) {
  const point = decodeLocation(item.payload ?? "");
  if (!point) return "Unreadable fix";
  return `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
}

function groupByDay(items) {
  const groups = [];
  for (const item of items) {
    const label = dayLabel(item.received_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export default function TransfersScreen() {
  const [tab, setTab] = useState("received");
  const [receivedItems, setReceivedItems] = useState([]);
  const [sentItems, setSentItems] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const read = useCallback(() => {
    setReceivedItems(listTransfers("received"));
    setSentItems(listTransfers("sent"));
    setPending(listPendingTransfers());
  }, []);

  const load = useCallback(
    async (mode = "focus") => {
      if (mode === "refresh") setRefreshing(true);

      try {
        read();
        await syncInbox({ force: mode === "refresh" });
      } catch {
        // The stored list is still worth showing.
      } finally {
        try {
          read();
        } catch {
          // Keep what is already on screen.
        }
        setLoading(false);
        setRefreshing(false);
      }
    },
    [read],
  );

  // Parts can keep arriving while this screen is open, so read the database
  // again every 15 seconds even without a new SMS event.
  useFocusEffect(
    useCallback(() => {
      load("focus");
      const timer = setInterval(() => load("timer"), 15_000);
      return () => clearInterval(timer);
    }, [load]),
  );

  // The foreground inbox poll can store an item while this screen is open.
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      INBOX_SYNCED_EVENT,
      () => {
        try {
          read();
        } catch {
          // Keep the list that is already on screen.
        }
      },
    );
    return () => subscription.remove();
  }, [read]);

  const currentItems = tab === "received" ? receivedItems : sentItems;
  const sections = useMemo(() => groupByDay(currentItems), [currentItems]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <AppHeader
        title="Shared items"
        onBack={goBack}
        right={
          refreshing ? (
            <ActivityIndicator color={colors.muted} style={styles.headerSpinner} />
          ) : (
            <View style={styles.headerActions}>
              <IconButton
                icon="send"
                label="Send something"
                onPress={() => router.push("/share")}
              />
              <IconButton
                icon="message-text"
                label="Payment requests"
                onPress={() => router.push("/sms-payments")}
              />
              <IconButton
                icon="reload"
                label="Refresh shared items"
                onPress={() => load("refresh")}
              />
            </View>
          )
        }
      />

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab("received")}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "received" }}
          style={[styles.tab, tab === "received" && styles.tabActive]}
        >
          <Text style={[type.label, tab === "received" && styles.tabActiveText]}>
            RECEIVED{receivedItems.length > 0 ? ` ${receivedItems.length}` : ""}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("sent")}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "sent" }}
          style={[styles.tab, tab === "sent" && styles.tabActive]}
        >
          <Text style={[type.label, tab === "sent" && styles.tabActiveText]}>
            SENT{sentItems.length > 0 ? ` ${sentItems.length}` : ""}
          </Text>
        </Pressable>
      </View>

      {loading && currentItems.length === 0 && (tab === "sent" || pending.length === 0) ? (
        <Loading
          label={tab === "received" ? "Checking for new items" : "Loading sent items"}
          style={styles.fill}
        />
      ) : currentItems.length === 0 && (tab === "sent" || pending.length === 0) ? (
        <View style={styles.empty}>
          <PixelIcon
            name={tab === "received" ? "inbox" : "send"}
            size={24}
            color={colors.muted}
          />
          <Text style={[type.body, styles.center]}>
            {tab === "received" ? "Nothing received yet." : "Nothing sent yet."}
          </Text>
          <Text style={[type.muted, styles.center]}>
            {tab === "received"
              ? "Pictures, QR codes and live location from your contacts land here."
              : "Pictures, QR codes and locations you share will be kept here."}
          </Text>
          <AppButton label="Send something" onPress={() => router.push("/share")} />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(section) => section.label}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            tab === "received" && pending.length > 0 ? (
              <View style={styles.section}>
                <Text style={type.label}>IN PROGRESS</Text>
                {pending.map((item) => (
                  <PendingRow key={item.transfer_key} item={item} />
                ))}
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh")}
              tintColor={colors.muted}
              colors={[colors.accent]}
            />
          }
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <Text style={type.label}>{section.label.toUpperCase()}</Text>
              {section.items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  items={currentItems}
                  isSent={tab === "sent"}
                />
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function PendingRow({ item }) {
  const total = Number(item.total) || 0;
  const received = Number(item.received_count) || 0;
  const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  const noun = NOUN[item.kind] ?? "message";
  const stalled = Date.now() - (Number(item.last_at) || 0) > 60_000;
  const missing = stalled ? getMissingPartIndices(item.transfer_key) : [];
  const shown = missing.slice(0, 6).map((seq) => `#${seq + 1}`);

  return (
    <View
      style={styles.pendingRow}
      accessibilityLabel={`Receiving ${noun}, ${received} of ${total} parts`}
    >
      <View style={styles.pendingTop}>
        <PixelIcon
          name={ICON[item.kind] ?? "inbox"}
          size={24}
          color={colors.text}
        />
        <View style={styles.rowText}>
          <Text style={type.bodyMedium} numberOfLines={1}>
            {item.sender || "Unknown sender"}
          </Text>
          <Text style={type.muted} numberOfLines={1}>
            Receiving {noun}: {received} of {total} parts ({percent}%)
          </Text>
        </View>
        <Text style={type.label}>IN PROGRESS</Text>
      </View>

      <View
        style={styles.progressTrack}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: received }}
      >
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>

      {missing.length > 0 ? (
        <Text style={[type.muted, styles.stalled]}>
          Waiting for parts {shown.join(", ")}
          {missing.length > shown.length
            ? ` and ${missing.length - shown.length} more`
            : ""}
        </Text>
      ) : null}
    </View>
  );
}

function Row({ item, items, isSent = false }) {
  const open = () => router.push(`/transfers/${item.id}`);
  const contactText = isSent
    ? item.recipient ? `To ${item.recipient}` : "Unknown recipient"
    : item.sender || "Unknown sender";

  if (item.kind === KIND.LOCATION) {
    const point = decodeLocation(item.payload ?? "");
    const sameSession = items.filter(
      (other) =>
        other.kind === KIND.LOCATION &&
        (isSent ? other.recipient === item.recipient : other.sender === item.sender) &&
        (other.session ?? "") === (item.session ?? ""),
    );
    const trail = buildTrail(
      sameSession.map((other) => decodeLocation(other.payload ?? "")).filter(Boolean),
    );

    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="Open shared location"
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <PixelIcon name="location" size={24} color={colors.text} />
        <View style={styles.rowText}>
          <Text style={type.bodyMedium} numberOfLines={1}>
            {contactText}
          </Text>
          <Text style={type.muted} numberOfLines={1}>
            {point ? locationLine(item) : "Unreadable fix"}
            {trail.points.length > 1
              ? ` · ${trail.points.length} pings`
              : ""}
          </Text>
        </View>
        <View style={styles.trailing}>
          <Text style={type.label}>{LABEL[item.kind]}</Text>
          <Text style={[type.muted, type.tabular]}>{formatClock(item.received_at)}</Text>
          <Text style={[type.muted, type.tabular]}>{formatAge(trail.ageMs)}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`Open ${LABEL[item.kind] ?? "item"}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {item.kind === KIND.IMAGE && item.payload_b64 ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.payload_b64}` }}
          style={styles.thumb}
        />
      ) : (
        <PixelIcon name={ICON[item.kind] ?? "message-text"} size={24} color={colors.text} />
      )}
      <View style={styles.rowText}>
        <Text style={type.bodyMedium} numberOfLines={1}>
          {contactText}
        </Text>
        <Text style={type.muted} numberOfLines={1}>
          {preview(item) ?? ""}
        </Text>
      </View>
      <View style={styles.trailing}>
        <Text style={type.label}>{LABEL[item.kind] ?? "ITEM"}</Text>
        <Text style={[type.muted, type.tabular]}>{formatClock(item.received_at)}</Text>
      </View>
    </Pressable>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
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
  list: {
    padding: space.lg,
    gap: space.xl,
  },
  section: {
    gap: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
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
  pendingRow: {
    gap: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radiusLg,
    backgroundColor: colors.panel,
  },
  pendingTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  stalled: {
    color: colors.text,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  trailing: {
    alignItems: "flex-end",
    gap: 2,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: radiusSm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
  },
  center: {
    textAlign: "center",
  },
});
