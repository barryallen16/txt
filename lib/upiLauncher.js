// Opens an installed UPI app using its Android Launch Intent (ACTION_MAIN, CATEGORY_LAUNCHER).
// This takes the user directly to the app's home dashboard without passing transaction parameters,
// preventing the "Something went wrong" validation crashes seen with bare upi://pay URLs.

import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

const native =
  Platform.OS === "android" ? requireOptionalNativeModule("OffTxtSms") : null;

/**
 * Open an installed UPI app using its launcher intent.
 * On Android, if multiple UPI apps are installed, this triggers a system chooser.
 * @returns {Promise<boolean>} whether a UPI app was successfully opened
 */
export async function openUpiLaunchIntent() {
  if (Platform.OS !== "android") return false;
  if (!native || typeof native.openUpiLaunchIntent !== "function") return false;

  try {
    return await native.openUpiLaunchIntent();
  } catch {
    return false;
  }
}
