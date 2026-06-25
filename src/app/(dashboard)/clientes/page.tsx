import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { ClientesClient } from "@/components/clientes/clientes-client"

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { q = "" } = await searchParams

  const clients = await db.contact.findMany({
    where: {
      status: "ACTIVE",
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { razaoSocial: { contains: q, mode: "insensitive" as const } },
          { cnpj: { contains: q } },
          { cpf: { contains: q } },
        ],
      } : {}),
    },
    include: {
      company: true,
      deals: { select: { value: true, status: true } },
      _count: { select: { activities: true } },
    },
    orderBy: { name: "asc" },
  })

  // Serialize Decimal fields
  type ClientRaw = typeof clients[number]
  const serialized = clients.map((c: ClientRaw) => ({
    ...c,
    creditLimit: c.creditLimit ? Number(c.creditLimit) : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    deals: c.deals.map((d: { value: { toNumber?: () => number } | number | null; status: string }) => ({ value: d.value ? Number(d.value) : 0, status: d.status })),
  }))

  return (
    <div>
      <Header title="Clientes" subtitle="Clientes ativos com análise de crédito" />
      <ClientesClient clients={serialized} currentQ={q} />
    </div>
  )
}
