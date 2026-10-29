import { createContext, useCallback, useContext, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import PixelIcon from "./PixelIcon";
import { colors, radius, space, type } from "../lib/theme";

const ToastContext = createContext(null);

let nextId = 0;

/**
 * A small bottom-anchored feedback toast. Screens call `show()` via `useToast()`
 * to tell the user an action completed (or failed). Toasts auto-dismiss after
 * `duration` ms and can be tapped away early.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback(
    ({ message, type = "info", duration = 3000 }) => {
      const id = ++nextId;
      const entry = { id, message, type };
      setToasts((current) => [...current, entry]);
      if (duration > 0) {
        setTimeout(() => {
          setToasts((current) => current.filter((t) => t.id !== id));
        }, duration);
      }
      return id;
    },
    [],
  );

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <View style={styles.container}>
        {toasts.map((toast) => (
          <Pressable
            key={toast.id}
            onPress={() => dismiss(toast.id)}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss: ${toast.message}`}
            style={[
              styles.row,
              toast.type === "danger" && styles.danger,
            ]}
          >
            <PixelIcon
              name={toast.type === "danger" ? "shield" : "info"}
              size={16}
              color={colors.accentInk}
            />
            <Text style={[type.body, styles.text]} numberOfLines={2}>
              {toast.message}
            </Text>
            <PixelIcon name="close" size={14} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: space.lg,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
    maxWidth: "88%",
  },
  danger: {
    borderColor: colors.danger,
  },
  text: {
    flex: 1,
  },
});
