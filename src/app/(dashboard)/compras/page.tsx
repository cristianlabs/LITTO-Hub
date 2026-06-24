import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { ComprasClient } from "@/components/compras/compras-client"
import { hasMinRole } from "@/lib/permissions"

export default async function ComprasPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasMinRole(session.user.role, "MANAGER")) redirect("/")

  const [rawOrders, pendingRequisitions] = await Promise.all([
    db.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        requisition: { select: { id: true, title: true, status: true } },
        items: true,
      },
    }),
    // Approved PURCHASE requisitions not yet linked to an order
    db.requisition.findMany({
      where: {
        category: "PURCHASE",
        status: "APPROVED",
        purchaseOrder: null,
      },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const orders = rawOrders.map((o) => ({
    ...o,
    totalValue: Number(o.totalValue),
    createdAt: o.createdAt.toISOString(),
    orderedAt: o.orderedAt?.toISOString() ?? null,
    receivedAt: o.receivedAt?.toISOString() ?? null,
    items: o.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  }))

  return (
    <div>
      <Header title="Compras" subtitle="Pedidos de compra e requisições aprovadas" />
      <ComprasClient
        initialOrders={orders}
        pendingRequisitions={pendingRequisitions}
        canManage={hasMinRole(session.user.role, "MANAGER")}
      />
    </div>
  )
}
