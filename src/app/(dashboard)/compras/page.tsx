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

  const [rawOrders, pendingRequisitions, rawSuppliers] = await Promise.all([
    db.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        requisition: { select: { id: true, title: true, status: true } },
        items: true,
      },
    }),
    db.requisition.findMany({
      where: { category: "PURCHASE", status: "APPROVED", purchaseOrder: null },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
    db.supplier.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
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

  // Match purchase orders to suppliers by the `supplier` name field (case-insensitive)
  const suppliers = rawSuppliers.map((s) => ({
    id: s.id, name: s.name, cnpj: s.cnpj, email: s.email, phone: s.phone, contact: s.contact,
    _count: s._count,
    purchaseOrders: rawOrders
      .filter((o) => o.supplier?.toLowerCase() === s.name.toLowerCase())
      .map((o) => ({ id: o.id, number: o.number, title: o.title, totalValue: Number(o.totalValue), status: o.status })),
  }))

  return (
    <div>
      <Header title="Compras" subtitle="Pedidos de compra e fornecedores" />
      <ComprasClient
        initialOrders={orders}
        pendingRequisitions={pendingRequisitions}
        suppliers={suppliers}
        canManage={hasMinRole(session.user.role, "MANAGER")}
      />
    </div>
  )
}
