"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  LayoutDashboard,
  Users,
  Building2,
  TrendingUp,
  UserCog,
  Package,
  ShoppingCart,
  MessageCircle,
  Bot,
  FileText,
  GraduationCap,
  ClipboardList,
  MessageSquare,
  Settings,
  LogOut,
  Landmark,
  ShieldAlert,
} from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import { ROLE_LABELS } from "@/lib/permissions"
import type { Role } from "@prisma/client"

const ALL_NAV_ITEMS = [
  { key: "dashboard", href: "/", label: "Dashboard", icon: LayoutDashboard },
  { key: "crm", href: "/crm", label: "CRM", icon: Users },
  { key: "clientes", href: "/clientes", label: "Clientes", icon: Building2 },
  { key: "vendas", href: "/vendas", label: "Vendas", icon: TrendingUp },
  { key: "financeiro", href: "/financeiro", label: "Financeiro", icon: Landmark },
  { key: "colaboradores", href: "/colaboradores", label: "Colaboradores", icon: UserCog },
  { key: "estoque", href: "/estoque", label: "Estoque", icon: Package },
  { key: "compras", href: "/compras", label: "Compras", icon: ShoppingCart },
  { key: "comunicacao", href: "/comunicacao", label: "Comunicação", icon: MessageCircle },
  { key: "chatbot", href: "/chatbot", label: "Chatbot", icon: Bot },
  { key: "nfe", href: "/nfe", label: "NF-e & Canhoto", icon: FileText },
  { key: "treinamentos", href: "/treinamentos", label: "Treinamentos", icon: GraduationCap },
  { key: "requisicoes", href: "/requisicoes", label: "Requisições", icon: ClipboardList },
  { key: "feedback", href: "/feedback", label: "Feedback", icon: MessageSquare },
  { key: "moderacao", href: "/moderacao", label: "Moderação", icon: ShieldAlert },
  { key: "configuracoes", href: "/configuracoes", label: "Configurações", icon: Settings },
]

interface Props {
  allowedModules: string[]
}

export function Sidebar({ allowedModules }: Props) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const navItems = ALL_NAV_ITEMS.filter((item) => allowedModules.includes(item.key))

  function isActive(href: string) {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="w-64 flex flex-col h-screen sticky top-0"
      style={{ backgroundColor: "#1e2a3a" }}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
            SE
          </div>
          <span className="text-white font-semibold text-sm leading-tight">
            Sistema Empresarial
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    active
                      ? "bg-blue-600 text-white font-medium"
                      : "text-slate-300 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User area */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {getInitials(session?.user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {session?.user?.name ?? "Usuário"}
            </p>
            <p className="text-slate-400 text-xs">
              {ROLE_LABELS[(session?.user?.role as Role) ?? "EMPLOYEE"]}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-slate-400 hover:text-white transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
