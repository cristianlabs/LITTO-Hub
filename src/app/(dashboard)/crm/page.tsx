import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { ContactsTable } from "@/components/crm/contacts-table"
import type { ContactStatus } from "@prisma/client"

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { q = "", status = "" } = await searchParams

  const contacts = await db.contact.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
              ],
            }
          : {},
        status ? { status: status as ContactStatus } : {},
      ],
    },
    include: { company: true },
    orderBy: { createdAt: "desc" },
  })

  const total = await db.contact.count()
  const counts = await db.contact.groupBy({
    by: ["status"],
    _count: true,
  })

  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]))

  return (
    <div>
      <Header title="CRM" subtitle="Gestão de contatos e relacionamentos" />
      <ContactsTable
        contacts={contacts}
        total={total}
        countMap={countMap}
        currentQ={q}
        currentStatus={status}
      />
    </div>
  )
}
