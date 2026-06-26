import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { RequisicoesClient } from "@/components/requisicoes/requisicoes-client"
import { hasMinRole } from "@/lib/permissions"
import type { Role } from "@prisma/client"

export default async function RequisicoesPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [requisitions, customStatuses] = await Promise.all([
    db.requisition.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
        customStatus: true,
        _count: { select: { comments: true } },
      },
    }).catch(() =>
      db.requisition.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
      })
    ),
    db.customRequisitionStatus.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }).catch(() => []),
  ])

  const serialized = requisitions.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))

  const isManager = hasMinRole(session.user.role as Role, "MANAGER")

  return (
    <div>
      <Header title="Requisições" subtitle="Solicitações internas — criação, votação e acompanhamento" />
      <RequisicoesClient
        initialRequisitions={serialized}
        isManager={isManager}
        currentUserId={session.user.id}
        customStatuses={customStatuses}
      />
    </div>
  )
}
