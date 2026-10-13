import { DomainError } from "../errors";
export type Role = "SUPER_USER" | "POH" | "MULTIMEDIA" | "INVENTARIS";
export type Permission =
  | "users:read"
  | "users:write"
  | "audit:read"
  | "settings:read"
  | "settings:write"
  | "members:read"
  | "members:write"
  | "content:write"
  | "recruitment:read"
  | "recruitment:write"
  | "inventory:write"
  | "loans:write"
  | "campaigns:write"
  | "events:write";
export interface Principal {
  userId: string;
  sessionId: string;
  role: Role;
  mustChangePassword: boolean;
}
const matrix: Record<Role, Permission[]> = {
  SUPER_USER: [
    "users:read",
    "users:write",
    "audit:read",
    "settings:read",
    "settings:write",
    "members:read",
    "members:write",
    "content:write",
    "recruitment:read",
    "recruitment:write",
    "inventory:write",
    "loans:write",
    "campaigns:write",
    "events:write",
  ],
  POH: ["members:read", "members:write", "recruitment:read"],
  MULTIMEDIA: [
    "events:write",
    "content:write",
    "recruitment:read",
    "recruitment:write",
    "campaigns:write",
  ],
  INVENTARIS: ["inventory:write", "loans:write", "recruitment:read"],
};
export function requirePermission(
  principal: Principal,
  permission: Permission,
) {
  if (
    principal.mustChangePassword ||
    !matrix[principal.role]?.includes(permission)
  )
    throw new DomainError("FORBIDDEN", 403, "Akses tidak diizinkan.");
}
