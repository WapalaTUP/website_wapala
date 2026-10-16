"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DataProvider } from "@/lib/store";
import type { DemoState } from "@/lib/types";
let theme = "light";
const themeListeners = new Set<() => void>();
const themeSubscribe = (fn: () => void) => {
  themeListeners.add(fn);
  return () => {
    themeListeners.delete(fn);
  };
};
function changeTheme(value: string) {
  theme = value;
  document.documentElement.dataset.theme = value;
  try {
    localStorage.setItem("wapala.theme", value);
  } catch {}
  themeListeners.forEach((fn) => fn());
}
const ToastContext = createContext<(message: string) => void>(() => {});
const SecurityNonceContext = createContext("");
export const useSecurityNonce = () => useContext(SecurityNonceContext);
export function Providers({
  children,
  initialState,
  nonce = "",
}: {
  children: ReactNode;
  initialState: DemoState;
  nonce?: string;
}) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      changeTheme(localStorage.getItem("wapala.theme") === "dark" ? "dark" : "light");
    } catch {
      changeTheme("light");
    }
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [message]);
  const toast = useCallback((value: string) => setMessage(value), []);
  return (
    <ToastContext.Provider value={toast}>
      <SecurityNonceContext.Provider value={nonce}>
        <DataProvider state={initialState}>{children}</DataProvider>
        <div className={"toast" + (message ? " visible" : "")} role="status" aria-live="polite">
          {message}
        </div>
      </SecurityNonceContext.Provider>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
export function useTheme() {
  const value = useSyncExternalStore(
    themeSubscribe,
    () => theme,
    () => "light",
  );
  return {
    theme: value,
    toggle: () => changeTheme(value === "light" ? "dark" : "light"),
  };
}
