// Reading a fix and mailing it out as one SMS.

import * as Location from "expo-location";
import { Platform } from "react-native";
import { saveTransfer } from "./db";
import { encodeLocation } from "./geo";
import { KIND, encodeTransfer } from "./transfer";
import { sendParts } from "./sms";

/**
 * Android shows its own "turn on location" dialog. Waiting for this is better
 * than writing a red line under the button after a silent failure.
 */
async function locationServicesEnabled() {
  const enabled = await Location.hasServicesEnabledAsync().catch(() => false);
  if (enabled) return true;

  if (Platform.OS === "android") {
    await Location.enableNetworkProviderAsync().catch(() => {});
  }

  return Location.hasServicesEnabledAsync().catch(() => false);
}

/**
 * Foreground access is enough for one-off fixes. Live sharing runs in a
 * foreground service and needs "Allow all the time" to survive a locked
 * screen.
 * @param {{ background?: boolean }} [options]
 * @returns {Promise<{ granted: boolean, reason: string | null }>}
 */
export async function requestLocationAccess({ background = true } = {}) {
  if (!(await locationServicesEnabled())) {
    return { granted: false, reason: "Location is off. Turn it on and try again." };
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    return { granted: false, reason: "Location permission was denied." };
  }

  if (background && Platform.OS === "android") {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== "granted") {
      return {
        granted: false,
        reason:
          "Choose 'Allow all the time' so location keeps sending with the screen off.",
      };
    }
  }

  return { granted: true, reason: null };
}

/**
 * One update: encode the fix, split into parts, send.
 * @param {{ address: string, session: string, fix: object }} input
 */
export async function shareLocation({ address, session, fix }) {
  const { payload } = encodeLocation({
    lat: fix.lat,
    lon: fix.lon,
    accuracy: fix.accuracy,
    timestamp: fix.timestamp,
    session,
  });

  const { parts, total } = encodeTransfer(KIND.LOCATION, payload);
  const result = await sendParts(address, parts);

  if (result.sent) {
    try {
      saveTransfer({
        transferKey: session,
        kind: KIND.LOCATION,
        recipient: address,
        payload,
        session,
        direction: "sent",
        receivedAt: Date.now(),
      });
    } catch {
      // Best effort saving
    }
  }

  return { ...result, payload, parts: total };
}
