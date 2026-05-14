// One place to read and request every permission the app needs. The setup
// screen and the home banner both use this so they never disagree.

import { Linking, PermissionsAndroid, Platform } from "react-native";
import * as Camera from "expo-camera";
import * as Contacts from "expo-contacts";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import RNAndroidNotificationListener from "react-native-android-notification-listener";
import { hasReadPermission, hasSendPermission, requestSmsPermissions } from "./sms";
import { withTimeout } from "./timeout";

const PROBE_TIMEOUT_MS = 1500;

/**
 * The screen can always render this, even when every native probe is wedged.
 * Missing permissions are safer than a spinner that never stops.
 */
export const DEFAULT_SNAPSHOT = {
  smsSend: false,
  smsRead: false,
  sms: false,
  contacts: false,
  contactsCanAsk: true,
  camera: false,
  cameraCanAsk: true,
  location: false,
  locationCanAsk: true,
  notifications: false,
  notificationsCanAsk: true,
  notificationListener: "missing",
};

async function androidPermission(permission, nativeCheck) {
  if (Platform.OS !== "android") return false;
  if (nativeCheck()) return true;
  try {
    return await PermissionsAndroid.check(permission);
  } catch {
    return false;
  }
}

/** Create the channel before Android 13 asks for notification access. */
function ensureDefaultChannel() {
  if (Platform.OS !== "android") return;
  Notifications.setNotificationChannelAsync("default", {
    name: "General",
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});
}

export async function getPermissionSnapshot() {
  try {
    ensureDefaultChannel();

    // Probes run together so one wedged module cannot hold up the other five.
    const [
      contacts,
      camera,
      location,
      notifications,
      smsSend,
      smsRead,
      listenerStatus,
    ] = await Promise.all([
      withTimeout(
        () => Contacts.getPermissionsAsync(),
        PROBE_TIMEOUT_MS,
        { status: "undetermined" },
      ),
      withTimeout(
        () => Camera.getCameraPermissionsAsync(),
        PROBE_TIMEOUT_MS,
        { status: "undetermined" },
      ),
      withTimeout(
        () => Location.getForegroundPermissionsAsync(),
        PROBE_TIMEOUT_MS,
        { status: "undetermined" },
      ),
      withTimeout(
        () => Notifications.getPermissionsAsync(),
        PROBE_TIMEOUT_MS,
        { granted: false },
      ),
      withTimeout(
        () => androidPermission(PermissionsAndroid.PERMISSIONS.SEND_SMS, hasSendPermission),
        PROBE_TIMEOUT_MS,
        false,
      ),
      withTimeout(
        () => androidPermission(PermissionsAndroid.PERMISSIONS.READ_SMS, hasReadPermission),
        PROBE_TIMEOUT_MS,
        false,
      ),
      Platform.OS === "android"
        ? withTimeout(
            () => RNAndroidNotificationListener.getPermissionStatus(),
            PROBE_TIMEOUT_MS,
            "missing",
          )
        : Promise.resolve("unavailable"),
    ]);

    return {
      smsSend,
      smsRead,
      sms: smsSend && smsRead,
      contacts: contacts?.status === "granted",
      contactsCanAsk: contacts?.canAskAgain !== false,
      camera: camera?.status === "granted",
      cameraCanAsk: camera?.canAskAgain !== false,
      location: location?.status === "granted",
      locationCanAsk: location?.canAskAgain !== false,
      notifications: notifications?.granted === true,
      notificationsCanAsk: notifications?.canAskAgain !== false,
      notificationListener:
        listenerStatus === "authorized"
          ? "authorized"
          : Platform.OS === "android"
            ? "missing"
            : "unavailable",
    };
  } catch {
    return { ...DEFAULT_SNAPSHOT };
  }
}

/** True when a fresh install still needs to finish setup. */
export function needsSetup(snapshot) {
  if (!snapshot) return false;
  if (Platform.OS !== "android") return false;
  return (
    snapshot.notificationListener !== "authorized" ||
    !snapshot.smsSend ||
    !snapshot.smsRead
  );
}

export async function requestSmsAccess() {
  if (Platform.OS !== "android") return false;
  return requestSmsPermissions({ read: true });
}

export async function requestContactsAccess() {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === "granted";
}

export async function requestCameraAccess() {
  const { status } = await Camera.requestCameraPermissionsAsync();
  return status === "granted";
}

export async function requestLocationAccess() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function requestNotificationAccess() {
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

export function requestNotificationListenerAccess() {
  if (Platform.OS !== "android") return;
  RNAndroidNotificationListener.requestPermission();
}

export function openAppSettings() {
  Linking.openSettings().catch(() => {});
}
