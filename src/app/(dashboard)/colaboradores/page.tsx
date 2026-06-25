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

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, email: true, role: true,
      active: true, createdAt: true,
      _count: { select: { activities: true, deals: true } },
    },
  })

  type UserRaw = typeof users[number]
  const serialized = users.map((u: UserRaw) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }))

  return (
    <div>
      <Header title="Colaboradores" subtitle="Gestão de equipe e permissões de acesso" />
      <ColaboradoresClient
        users={serialized}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </div>
  )
}
