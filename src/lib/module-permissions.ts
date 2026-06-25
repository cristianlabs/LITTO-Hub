import type { Role } from "@prisma/client"

export interface ModuleDef {
  key: string
  label: string
  href: string
}

export const ALL_MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "crm", label: "CRM", href: "/crm" },
  { key: "clientes", label: "Clientes", href: "/clientes" },
  { key: "vendas", label: "Vendas", href: "/vendas" },
  { key: "financeiro", label: "Financeiro", href: "/financeiro" },
  { key: "colaboradores", label: "Colaboradores", href: "/colaboradores" },
  { key: "estoque", label: "Estoque", href: "/estoque" },
  { key: "compras", label: "Compras", href: "/compras" },
  { key: "comunicacao", label: "Comunicação", href: "/comunicacao" },
  { key: "chatbot", label: "Chatbot", href: "/chatbot" },
  { key: "nfe", label: "NF-e & Canhoto", href: "/nfe" },
  { key: "treinamentos", label: "Treinamentos", href: "/treinamentos" },
  { key: "requisicoes", label: "Requisições", href: "/requisicoes" },
  { key: "feedback", label: "Feedback", href: "/feedback" },
  { key: "moderacao", label: "Moderação", href: "/moderacao" },
  { key: "configuracoes", label: "Configurações", href: "/configuracoes" },
]

export const ROLES_ORDERED: Role[] = ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"]

// Default permissions: all roles for all modules (open by default)
export const DEFAULT_PERMISSIONS: Record<string, Role[]> = {
  dashboard: ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"],
  crm: ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER"],
  clientes: ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER"],
  vendas: ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER"],
  financeiro: ["OWNER", "HEAD_LEADER", "MANAGER"],
  colaboradores: ["OWNER", "HEAD_LEADER", "MANAGER"],
  estoque: ["OWNER", "HEAD_LEADER", "MANAGER", "EMPLOYEE"],
  compras: ["OWNER", "HEAD_LEADER", "MANAGER"],
  comunicacao: ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"],
  chatbot: ["OWNER", "HEAD_LEADER", "MANAGER"],
  nfe: ["OWNER", "HEAD_LEADER", "MANAGER"],
  treinamentos: ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"],
  requisicoes: ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"],
  feedback: ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"],
  moderacao: ["OWNER", "HEAD_LEADER", "MANAGER"],
  configuracoes: ["OWNER", "HEAD_LEADER"],
}
