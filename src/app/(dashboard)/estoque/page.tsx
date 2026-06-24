import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { StockTable } from "@/components/estoque/stock-table"
import { Package, AlertTriangle, XCircle, DollarSign } from "lucide-react"

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { filter = "", q = "" } = await searchParams

  const [allProducts, zeroProducts, categories, suppliers] = await Promise.all([
    db.product.count({ where: { active: true } }),
    db.product.count({ where: { active: true, currentStock: 0 } }),
    db.productCategory.findMany({ orderBy: { name: "asc" } }),
    db.supplier.findMany({ orderBy: { name: "asc" } }),
  ])

  const minProducts = await db.product.count({
    where: { active: true, currentStock: { gt: 0 } },
  })

  const totalValue = await db.product.aggregate({
    where: { active: true },
    _sum: { currentStock: true },
  })

  const baseWhere = {
    active: true,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  }

  const allFiltered = await db.product.findMany({
    where: baseWhere,
    include: { category: true, supplier: true },
    orderBy: { name: "asc" },
  })

  const rawProducts =
    filter === "zero"
      ? allFiltered.filter((p) => p.currentStock <= 0)
      : filter === "min"
        ? allFiltered.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStock)
        : allFiltered

  const products = rawProducts.map((p) => ({
    ...p,
    costPrice: p.costPrice ? Number(p.costPrice) : null,
    salePrice: p.salePrice ? Number(p.salePrice) : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  return (
    <div>
      <Header title="Estoque" subtitle="Controle de produtos e movimentações" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Produtos ativos", value: allProducts, Icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Estoque mínimo", value: minProducts, Icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50" },
            { label: "Zerados", value: zeroProducts, Icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
            { label: "Unidades totais", value: totalValue._sum.currentStock ?? 0, Icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
          ].map(({ label, value, Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <StockTable
          products={products}
          categories={categories}
          suppliers={suppliers}
          currentFilter={filter}
          currentQ={q}
        />
      </div>
    </div>
  )
}
