// Web stub for expo-notifications.
// On the web, push token listeners and native notification handlers are not supported
// and trigger console warnings when imported. This stub provides safe no-ops.

export const setNotificationHandler = () => {};
export const scheduleNotificationAsync = async () => {};
export const clearLastNotificationResponseAsync = async () => {};
export const getLastNotificationResponseAsync = async () => null;
export const addNotificationResponseReceivedListener = () => ({
  remove: () => {},
});
export const getPermissionsAsync = async () => ({
  granted: false,
  canAskAgain: false,
  status: "undetermined",
});
export const requestPermissionsAsync = async () => ({
  granted: false,
  canAskAgain: false,
  status: "undetermined",
});
export const setNotificationChannelAsync = async () => {};
export const setNotificationCategoryAsync = async () => {};

export default {
  setNotificationHandler,
  scheduleNotificationAsync,
  clearLastNotificationResponseAsync,
  getLastNotificationResponseAsync,
  addNotificationResponseReceivedListener,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  setNotificationCategoryAsync,
};
