import { Role } from "@prisma/client"

export const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 100,
  HEAD_LEADER: 80,
  MANAGER: 60,
  SELLER: 40,
  EMPLOYEE: 20,
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Proprietário",
  HEAD_LEADER: "Líder Geral",
  MANAGER: "Gerente",
  SELLER: "Vendedor(a)",
  EMPLOYEE: "Colaborador(a)",
}

export const ROLE_COLORS: Record<Role, string> = {
  OWNER: "bg-purple-100 text-purple-800",
  HEAD_LEADER: "bg-blue-100 text-blue-800",
  MANAGER: "bg-green-100 text-green-800",
  SELLER: "bg-yellow-100 text-yellow-800",
  EMPLOYEE: "bg-gray-100 text-gray-800",
}

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]
}

export function canRevealFeedbackIdentity(userRole: Role): boolean {
  return hasMinRole(userRole, "HEAD_LEADER")
}

export function canManageUsers(userRole: Role): boolean {
  return hasMinRole(userRole, "MANAGER")
}

export function canApproveRequisitions(userRole: Role): boolean {
  return hasMinRole(userRole, "MANAGER")
}
