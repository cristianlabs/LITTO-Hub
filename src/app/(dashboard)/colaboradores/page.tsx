export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { ColaboradoresClient } from "@/components/colaboradores/colaboradores-client"
import { hasMinRole } from "@/lib/permissions"

export default async function ColaboradoresPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasMinRole(session.user.role, "MANAGER")) redirect("/")

  const [users, customRoles] = await Promise.all([
    db.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, email: true, role: true,
        active: true, createdAt: true,
        customRole: { select: { id: true, name: true, color: true, baseRole: true } },
        _count: { select: { activities: true, deals: true } },
      },
    }),
    db.customRole.findMany({ orderBy: { name: "asc" } }),
  ])

  const serialized = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }))

  return (
    <div>
      <Header title="Colaboradores" subtitle="Gestão de equipe e permissões de acesso" />
      <ColaboradoresClient
        users={serialized}
        customRoles={customRoles}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </div>
  )
}
