"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { Role } from "./types";
export const roles: Role[] = ["Super User", "POH", "Multimedia", "Inventaris"];
let current: Role | "" = "";
const listeners = new Set<() => void>();
export function setRole(role: Role | "") {
  current = role;
  try {
    if (role) sessionStorage.setItem("wapala.demo.role", role);
    else sessionStorage.removeItem("wapala.demo.role");
  } catch {}
  listeners.forEach((fn) => fn());
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function useRole() {
  useEffect(() => {
    const saved = sessionStorage.getItem("wapala.demo.role") as Role;
    if (roles.includes(saved)) setRole(saved);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => "" as Role | "",
  );
}
