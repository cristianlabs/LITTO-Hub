export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { VendasClient } from "@/components/vendas/vendas-client"

export default async function VendasPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [rawDeals, sellers, pipelines, contacts, products] = await Promise.all([
    db.deal.findMany({
      include: {
        contact: { select: { id: true, name: true } },
        pipeline: { select: { id: true, name: true, color: true } },
        seller: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.pipeline.findMany({ orderBy: { order: "asc" } }),
    db.contact.findMany({
      where: { status: { in: ["LEAD", "PROSPECT", "ACTIVE"] } },
      select: { id: true, name: true, phone: true, whatsapp: true },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true, salePrice: true, currentStock: true, unit: true },
      orderBy: { name: "asc" },
    }),
  ])

  const deals = rawDeals.map((d) => ({
    id: d.id,
    title: d.title,
    value: d.value ? Number(d.value) : null,
    status: d.status as "OPEN" | "WON" | "LOST",
    createdAt: d.createdAt.toISOString(),
    closedAt: d.closedAt?.toISOString() ?? null,
    expectedClose: d.expectedClose?.toISOString() ?? null,
    contact: d.contact,
    pipeline: d.pipeline,
    seller: d.seller,
    items: d.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  }))

  return (
    <div>
      <Header title="Vendas" subtitle="Gestão de negócios e performance comercial" />
      <VendasClient
        initialDeals={deals}
        sellers={sellers}
        pipelines={pipelines}
        contacts={contacts}
        products={products.map((p) => ({ ...p, salePrice: Number(p.salePrice) }))}
      />
    </div>
  )
}
