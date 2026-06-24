import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { KanbanBoard } from "@/components/crm/kanban-board"

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
      <KanbanBoard pipelines={serializedPipelines} contacts={contacts} />
    </div>
  )
}
