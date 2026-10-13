"use client";
import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";
import type { DemoState, Role } from "./types";
import { emptyState } from "./empty-state";

const DataContext = createContext<DemoState | null>(null);
const unavailableState = emptyState();
export function DataProvider({
  state,
  children,
}: {
  state: DemoState;
  children?: ReactNode;
}) {
  return createElement(DataContext.Provider, { value: state }, children);
}
// Compatibility for older callers: data comes only from the supplied server
// snapshot. Browser storage and environment flags cannot enable local authority.
export function bootStore(preview?: boolean) {
  void preview;
}
export function updateStore(
  ...args: [
    recipe: (draft: DemoState) => void,
    action?: string,
    target?: string,
    actor?: Role,
    reason?: string,
  ]
): never {
  void args;
  throw new Error(
    "Gunakan formulir yang terhubung ke server. Data browser tidak dapat disimpan sebagai data nyata.",
  );
}
export function resetStore(): never {
  throw new Error("Data server tidak dapat direset dari penyimpanan browser.");
}
export function useDemo() {
  return useContext(DataContext) || unavailableState;
}
export function getDemo() {
  return unavailableState;
}
