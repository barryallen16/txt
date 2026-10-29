// One copy helper for every platform, so every copy action shows the same
// feedback. Web falls back to a hidden textarea when navigator.clipboard is
// unavailable (insecure http origins), which keeps the "copied" toast honest.

import { Platform } from "react-native";

export async function copyText(text) {
  const value = String(text ?? "");
  if (!value) return false;

  if (Platform.OS !== "web") {
    const ExpoClipboard = require("expo-clipboard");
    try {
      await ExpoClipboard.setStringAsync(value);
      return true;
    } catch {
      return false;
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the textarea path below.
    }
  }

  try {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(input);
    return ok;
  } catch {
    return false;
  }
}
