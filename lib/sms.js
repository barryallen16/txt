// Thin wrapper around the local native module. Everything degrades to
// "unavailable" instead of throwing so the screens can explain themselves.

import { requireOptionalNativeModule } from "expo";
import { PermissionsAndroid, Platform } from "react-native";
import * as SMS from "expo-sms";
import { getSmsQuota, recordSmsUsage } from "./quota";

const native = Platform.OS === "android" ? requireOptionalNativeModule("OffTxtSms") : null;

export const nativeSmsAvailable = native != null;

export function hasSendPermission() {
  try {
    return native ? native.hasSendPermission() : false;
  } catch {
    return false;
  }
}

export function hasReadPermission() {
  try {
    return native ? native.hasReadPermission() : false;
  } catch {
    return false;
  }
}

/**
 * Ask for SEND_SMS, and optionally READ_SMS.
 * @param {{ read?: boolean }} [options]
 */
export async function requestSmsPermissions({ read = true } = {}) {
  if (Platform.OS !== "android") return false;

  const wanted = [PermissionsAndroid.PERMISSIONS.SEND_SMS];
  if (read) wanted.push(PermissionsAndroid.PERMISSIONS.READ_SMS);

  const result = await PermissionsAndroid.requestMultiple(wanted);
  const granted = wanted.every(
    (permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
  return granted;
}

/**
 * Make sure we may send silently. Returns false when the user says no.
 */
export async function ensureSendPermission() {
  if (hasSendPermission()) return true;
  return requestSmsPermissions({ read: true });
}

/**
 * Send pre-built parts, each as its own SMS. Falls back to the compose screen
 * when the native module is missing, which needs a tap from the user.
 * @param {string} address
 * @param {string[]} parts
 * @param {number | null} [simSlot]
 * @param {((progress: { current: number, total: number }) => void) | null} [onProgress]
 * @returns {Promise<{ sent: boolean, segments: number, reason: string | null }>}
 */
export async function sendParts(
  address,
  parts,
  simSlot = null,
  onProgress = null,
) {
  if (!address || !parts?.length) {
    return { sent: false, segments: 0, reason: "No recipient." };
  }

  const report = (current, total) => {
    if (typeof onProgress !== "function") return;
    try {
      onProgress({ current, total });
    } catch {
      // A screen that unmounted mid-send must not abort the transfer.
    }
  };

  const estimate = parts.reduce(
    (total, part) => total + Math.max(1, Math.ceil(String(part).length / 160)),
    0,
  );

  // Stop before a transfer that cannot finish today. Sending a partial
  // multipart item leaves the receiver with an un-reassemblable fragment.
  try {
    const quota = getSmsQuota();
    if (estimate > quota.remaining) {
      return {
        sent: false,
        segments: 0,
        reason:
          quota.remaining === 0
            ? "Daily SMS limit reached. Try again after midnight."
            : `This needs ${estimate} SMS but only ${quota.remaining} are left today.`,
      };
    }
  } catch {
    // If the counter cannot be read, sending still works.
  }

  if (native && hasSendPermission()) {
    let subscription = null;
    if (typeof onProgress === "function") {
      try {
        subscription = native.addListener?.("onSendProgress", (event) => {
          const current = Number(event?.current) || 0;
          const total = Number(event?.total) || parts.length;
          if (current > 0) report(Math.min(current, total), total);
        });
      } catch {
        // An older native build may not expose the event.
        subscription = null;
      }
    }

    try {
      const segments = await native.sendParts(address, parts, simSlot);
      report(parts.length, parts.length);
      const sent = Number(segments) || estimate || parts.length;
      try {
        recordSmsUsage(sent);
      } catch {
        // The SMS left the phone even if the local counter is unavailable.
      }
      return { sent: true, segments: sent, reason: null };
    } catch (error) {
      return {
        sent: false,
        segments: 0,
        reason: error?.message ?? "The phone rejected the message.",
      };
    } finally {
      subscription?.remove?.();
    }
  }

  const available = await SMS.isAvailableAsync();
  if (!available) {
    return { sent: false, segments: 0, reason: "SMS is not available." };
  }

  const { result } = await SMS.sendSMSAsync([address], parts.join(""));
  if (result === "sent") {
    report(parts.length, parts.length);
    try {
      recordSmsUsage(estimate);
    } catch {
      // The message left through the composer; the counter is best effort.
    }
  }
  return {
    sent: result === "sent",
    segments: estimate,
    reason: result === "sent" ? null : "Message left unsent.",
  };
}

/**
 * Read the SMS inbox since a timestamp. Used to pick up every part of a
 * multipart payload.
 * @param {number} sinceMs
 * @param {number} limit
 * @returns {Promise<Array<{ id: number, address: string, body: string, date: number }>>}
 */
export async function readRecent(sinceMs, limit = 50) {
  if (!native || !hasReadPermission()) return [];
  const rows = await native.readRecent(limit, sinceMs);
  return Array.isArray(rows) ? rows : [];
}


/**
 * Listen for native SMS ContentObserver events (incoming SMS written to Android database).
 * @param {() => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeToSmsArrival(callback) {
  if (!native || Platform.OS !== "android") return () => {};
  try {
    try {
      native.startSmsObserver?.();
    } catch {}
    const subscription = native.addListener?.("onSmsReceived", () => {
      try {
        callback();
      } catch {}
    });
    return () => {
      subscription?.remove?.();
    };
  } catch {
    return () => {};
  }
}
