import * as Notifications from "expo-notifications";

export const setNotificationHandler = Notifications.setNotificationHandler;
export const scheduleNotificationAsync = Notifications.scheduleNotificationAsync;
export const clearLastNotificationResponseAsync = Notifications.clearLastNotificationResponseAsync;
export const getLastNotificationResponseAsync = Notifications.getLastNotificationResponseAsync;
export const addNotificationResponseReceivedListener = Notifications.addNotificationResponseReceivedListener;
export const getPermissionsAsync = Notifications.getPermissionsAsync;
export const requestPermissionsAsync = Notifications.requestPermissionsAsync;
export const setNotificationChannelAsync = Notifications.setNotificationChannelAsync;
export const setNotificationCategoryAsync = Notifications.setNotificationCategoryAsync;

export default Notifications;
