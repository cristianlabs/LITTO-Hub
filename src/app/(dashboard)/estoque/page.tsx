import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { Package, AlertTriangle, TrendingDown, XCircle, ArrowDown, ArrowUp } from "lucide-react"
import Link from "next/link"

function StockBadge({ product }: { product: { currentStock: number; minStock: number; maxStock: number } }) {
  if (product.currentStock <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
        <XCircle className="w-3 h-3" /> Zerado
      </span>
    )
  }
  if (product.currentStock <= product.minStock) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
        <AlertTriangle className="w-3 h-3" /> Est. mínimo
      </span>
    )
  }
  if (product.currentStock >= product.maxStock) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
        <TrendingDown className="w-3 h-3" /> Est. máximo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
      Normal
    </span>
  )
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { filter = "" } = await searchParams

  const [allProducts, zeroProducts, minProducts] = await Promise.all([
    db.product.count({ where: { active: true } }),
    db.product.count({ where: { active: true, currentStock: 0 } }),
    db.product.count({ where: { active: true, currentStock: { gt: 0 } } }),
  ])

  const totalStock = await db.product.aggregate({
    where: { active: true },
    _sum: { currentStock: true },
  })

  const products = await db.product.findMany({
    where: {
      active: true,
      ...(filter === "zero" ? { currentStock: 0 } : {}),
    },
    include: { category: true },
    orderBy: { name: "asc" },
  })

  const filteredProducts =
    filter === "min" ? products.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStock) : products

  return (
    <div>
      <Header title="Estoque" subtitle="Controle de produtos e movimentações" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total de Produtos", value: allProducts, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Unidades em Estoque", value: totalStock._sum.currentStock ?? 0, icon: Package, color: "text-green-600", bg: "bg-green-50" },
            { label: "Estoque Mínimo", value: minProducts, icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50" },
            { label: "Zerados", value: zeroProducts, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
          ].map((s) => {
            const Icon = s.icon
            return (
              <Card key={s.label}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {[
            { key: "", label: "Todos" },
            { key: "zero", label: "Zerados" },
            { key: "min", label: "Est. mínimo" },
          ].map((f) => (
            <Link
              key={f.key}
              href={`/estoque?filter=${f.key}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Produto</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">SKU</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Categoria</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Estoque</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Mín / Máx</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Preço Venda</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{p.name}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3">
                      {p.category ? (
                        <span
                          className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: p.category.color }}
                        >
                          {p.category.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-semibold ${p.currentStock === 0 ? "text-red-600" : p.currentStock <= p.minStock ? "text-yellow-600" : "text-gray-900"}`}
                      >
                        {p.currentStock} {p.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {p.minStock} / {p.maxStock}
                    </td>
                    <td className="px-4 py-3">
                      <StockBadge product={p} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(p.salePrice.toString())}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-medium">
                          <ArrowDown className="w-3 h-3" /> Entrada
                        </button>
                        <button className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-medium">
                          <ArrowUp className="w-3 h-3" /> Saída
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
