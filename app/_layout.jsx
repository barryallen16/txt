import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { Stack, router, useRootNavigationState } from "expo-router";
import { useFonts } from "expo-font";
import Notifications from "../lib/notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { colors, fontFiles } from "../lib/theme";
import { getMeta } from "../lib/db";
import { syncInbox } from "../lib/syncInbox";
import { subscribeToSmsArrival } from "../lib/sms";
import { ToastProvider } from "../components/Toast";

SplashScreen.preventAutoHideAsync().catch(() => {});

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const navigationState = useRootNavigationState();
  const checkedOnboarding = useRef(false);
  const [appActive, setAppActive] = useState(
    AppState.currentState !== "background",
  );
  const ready =
    Boolean(navigationState?.key) &&
    appActive &&
    (Boolean(fontsLoaded) || Boolean(fontError));
  const readyRef = useRef(ready);
  const pendingRoute = useRef(null);
  const handledNotification = useRef(null);

  const flushPendingRoute = useCallback(() => {
    if (!readyRef.current) return;

    const route = pendingRoute.current;
    if (!route) return;

    // Never let a stale notification skip the first-run setup.
    try {
      if (getMeta("onboarding_complete") !== "1") {
        pendingRoute.current = null;
        return;
      }
    } catch {
      return;
    }

    pendingRoute.current = null;
    Notifications.clearLastNotificationResponseAsync().catch(() => {});

    // Wait for the current render and the focus change to settle. Pushing while
    // the app is still coming to the foreground can drop the navigation.
    setTimeout(() => {
      router.navigate(route);
    }, 60);
  }, []);

  useEffect(() => {
    readyRef.current = ready;
    if (ready) flushPendingRoute();
  }, [ready, flushPendingRoute]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Web accessibility floor: every keyboard-focusable element needs a visible
  // focus ring. React Native Web suppresses outlines, so add one back while
  // keeping :focus-visible (readonly pointer focus stays clean).
  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    const style = document.createElement("style");
    style.textContent = `
      html, body, #root {
        background-color: #02070A !important;
        color-scheme: dark;
      }
      body {
        overflow-x: hidden;
        overscroll-behavior-y: none;
      }
      *:focus-visible {
        outline: 2px solid #0593C6 !important;
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  // On the very first launch, walk the user through how txt works and the
  // terms, then ask for the permissions the app cannot work without.
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!navigationState?.key) return;
    if (!fontsLoaded && !fontError) return;
    if (checkedOnboarding.current) return;
    checkedOnboarding.current = true;

    try {
      if (getMeta("onboarding_complete") !== "1") {
        router.replace("/how-it-works");
      }
    } catch {
      // If the flag cannot be read, do not block the app.
    }
  }, [navigationState?.key, fontsLoaded, fontError]);

  // A tap always opens the inbox. It never starts a UPI app on its own.
  // The route is queued until navigation and the app are both ready, because a
  // response can arrive before the navigator mounts on a cold start.
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    const routeFor = (response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.transferId != null) return `/transfers/${data.transferId}`;
      // A "receiving" note points at the progress card in the inbox.
      if (data?.transferKey) return "/transfers";
      return "/sms-payments";
    };

    const queue = (response) => {
      if (!response) return;

      const id = response?.notification?.request?.identifier ?? null;
      if (id && handledNotification.current === id) return;
      handledNotification.current = id;

      pendingRoute.current = routeFor(response);
      flushPendingRoute();
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(queue);

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) queue(response);
      })
      .catch(() => {});

    return () => subscription.remove();
  }, [flushPendingRoute]);

  // Real-time SMS observer: immediately triggers inbox sync when an SMS arrives.
  // Debounced slightly so Android's SMS ContentProvider finishes committing the row.
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    let timer = null;
    const unsubscribe = subscribeToSmsArrival(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        syncInbox({ force: false }).catch(() => {});
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Notification access can be off, or a messaging app may post no
  // notification at all. Poll the SMS inbox every 3s while the app is active in
  // foreground so those requests still show up without a restart.
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    if (!navigationState?.key) return undefined;

    let timer = null;
    const tick = () => {
      syncInbox().catch(() => {});
    };
    const start = () => {
      tick();
      if (timer) return;
      timer = setInterval(tick, 3_000);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    start();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncInbox().catch(() => {});
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, [navigationState?.key]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ToastProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </ToastProvider>
  );
}
