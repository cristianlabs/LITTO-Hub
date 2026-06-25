import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { ContactDetail } from "@/components/crm/contact-detail"

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params

  const contact = await db.contact.findUnique({
    where: { id },
    include: {
      company: true,
      deals: {
        include: { pipeline: true },
        orderBy: { createdAt: "desc" },
      },
      activities: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!contact) notFound()

  // Serialize Prisma Decimal → number so Client Components don't blow up
  const serialized = {
    ...contact,
    deals: contact.deals.map((d) => ({
      ...d,
      value: d.value != null ? parseFloat(d.value.toString()) : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      expectedClose: d.expectedClose?.toISOString() ?? null,
      closedAt: d.closedAt?.toISOString() ?? null,
    })),
    activities: contact.activities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      dueDate: a.dueDate?.toISOString() ?? null,
    })),
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  }

  return (
    <div>
      <Header
        title={contact.name}
        subtitle={contact.company?.name ?? "Contato sem empresa"}
      />
      <ContactDetail contact={serialized} />
    </div>
  )
}
