import { describe, expect, mock, test } from "bun:test";

const hanging = () => new Promise(() => {});

// The permission layer only needs one shape from each native package. Mocking
// them lets the test hang every probe without an Android device.
mock.module("./sms", () => ({
  hasReadPermission: () => true,
  hasSendPermission: () => true,
  requestSmsPermissions: async () => true,
}));

mock.module("react-native", () => ({
  Linking: { openSettings: async () => {} },
  PermissionsAndroid: {
    PERMISSIONS: {
      SEND_SMS: "SEND_SMS",
      READ_SMS: "READ_SMS",
      CAMERA: "CAMERA",
    },
    RESULTS: { GRANTED: "granted" },
    check: async (permission) => permission !== "CAMERA",
    requestMultiple: async () => ({}),
  },
  Platform: { OS: "android" },
}));

mock.module("expo-camera", () => ({
  getCameraPermissionsAsync: hanging,
  requestCameraPermissionsAsync: async () => ({ status: "granted" }),
}));

mock.module("expo-contacts", () => ({
  getPermissionsAsync: hanging,
  requestPermissionsAsync: async () => ({ status: "granted" }),
}));

mock.module("expo-location", () => ({
  getForegroundPermissionsAsync: hanging,
  requestForegroundPermissionsAsync: async () => ({ status: "granted" }),
}));

mock.module("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 5 },
  getPermissionsAsync: hanging,
  requestPermissionsAsync: async () => ({ granted: false }),
  setNotificationChannelAsync: async () => {},
}));

mock.module("react-native-android-notification-listener", () => ({
  default: {
    getPermissionStatus: hanging,
    requestPermission: () => {},
  },
}));

const { DEFAULT_SNAPSHOT, getPermissionSnapshot } = await import("./permissions");
const { withTimeout } = await import("./timeout");

describe("permission probes", () => {
  test("withTimeout falls back when the probe never settles", async () => {
    const started = Date.now();
    const result = await withTimeout(new Promise(() => {}), 30, "fallback");

    expect(result).toBe("fallback");
    expect(Date.now() - started).toBeLessThan(500);
  });

  test("withTimeout falls back when the probe rejects", async () => {
    const result = await withTimeout(
      Promise.reject(new Error("native module missing")),
      30,
      "fallback",
    );

    expect(result).toBe("fallback");
  });

  test("a snapshot resolves even when every native probe hangs", async () => {
    const started = Date.now();
    const snapshot = await getPermissionSnapshot();
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(2500);
    expect(snapshot).toEqual({
      ...DEFAULT_SNAPSHOT,
      smsSend: true,
      smsRead: true,
      sms: true,
    });
  });
});
