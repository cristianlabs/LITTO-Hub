export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { CalendarioCrm } from "@/components/crm/calendario-crm"
import Link from "next/link"
import { ArrowLeft, Users, GitBranch } from "lucide-react"

export default async function CalendarioPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const isPrivileged = session.user.role === "OWNER" || session.user.role === "HEAD_LEADER"

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Agenda CRM"
        subtitle="Visualize vendas, tarefas, pedidos e financeiro em um calendário"
      />

      {/* Nav tabs */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-1">
          <Link
            href="/crm"
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Users className="w-4 h-4" />
            Contatos
          </Link>
          <Link
            href="/crm/pipeline"
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors"
          >
            <GitBranch className="w-4 h-4" />
            Pipeline
          </Link>
          <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
            <span>📅</span>
            Agenda
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <CalendarioCrm isPrivileged={isPrivileged} />
      </div>
    </div>
  )
}
