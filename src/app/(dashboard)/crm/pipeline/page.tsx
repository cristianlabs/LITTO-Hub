import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { KanbanBoard } from "@/components/crm/kanban-board"
import Link from "next/link"
import { Users, GitBranch } from "lucide-react"

export default async function PipelinePage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [pipelines, contacts] = await Promise.all([
    db.pipeline.findMany({
      orderBy: { order: "asc" },
      include: {
        deals: {
          where: { status: "OPEN" },
          include: { contact: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.contact.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const serializedPipelines = pipelines.map((p) => ({
    ...p,
    deals: p.deals.map((d) => ({
      ...d,
      value: Number(d.value),
      expectedClose: d.expectedClose?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  }))

  return (
    <div className="flex flex-col h-full">
      <Header title="Pipeline" subtitle="Negócios por etapa do funil" />
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-1">
          <Link href="/crm" className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors">
            <Users className="w-4 h-4" />Contatos
          </Link>
          <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
            <GitBranch className="w-4 h-4" />Pipeline
          </div>
          <Link href="/crm/calendario" className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors">
            <span>📅</span>Agenda
          </Link>
        </div>
      </div>
      <KanbanBoard pipelines={serializedPipelines} contacts={contacts} />
    </div>
  )
}
