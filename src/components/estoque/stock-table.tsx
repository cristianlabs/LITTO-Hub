"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ProductFormSheet } from "./product-form-sheet"
import { MovementDialog } from "./movement-dialog"
import { ImportDialog } from "./import-dialog"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertTriangle, XCircle, TrendingDown, CheckCircle2,
  ArrowDown, ArrowUp, Pencil, Trash2, Search, Plus, History, FileSpreadsheet,
} from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface Category { id: string; name: string; color: string }
interface Supplier { id: string; name: string }
interface Product {
  id: string; sku: string; name: string; description?: string | null
  barcode?: string | null; categoryId?: string | null; supplierId?: string | null
  costPrice: number | null; salePrice: number | null
  unit: string; currentStock: number; minStock: number; maxStock: number; active: boolean
  category?: Category | null; supplier?: Supplier | null
}

interface Props {
  products: Product[]
  categories: Category[]
  suppliers: Supplier[]
  currentFilter: string
  currentQ: string
}

function StockBadge({ p }: { p: Product }) {
  if (p.currentStock <= 0)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium"><XCircle className="w-3 h-3" />Zerado</span>
  if (p.currentStock <= p.minStock)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium"><AlertTriangle className="w-3 h-3" />Mínimo</span>
  if (p.currentStock >= p.maxStock)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"><TrendingDown className="w-3 h-3" />Máximo</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium"><CheckCircle2 className="w-3 h-3" />Normal</span>
}

export function StockTable({ products, categories, suppliers, currentFilter, currentQ }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | undefined>()
  const [moveProduct, setMoveProduct] = useState<Product | undefined>()
  const [moveType, setMoveType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN")
  const [deleteId, setDeleteId] = useState<string | undefined>()
  const [search, setSearch] = useState(currentQ)
  const [importOpen, setImportOpen] = useState(false)

  function applyFilter(filter: string, q = search) {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (filter) params.set("filter", filter)
    router.push(`${pathname}?${params.toString()}`)
  }

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router])

  function openMove(p: Product, type: "IN" | "OUT" | "ADJUSTMENT") {
    setMoveProduct(p); setMoveType(type)
  }

  async function confirmDelete() {
    if (!deleteId) return
    await fetch(`/api/estoque/produtos/${deleteId}`, { method: "DELETE" })
    setDeleteId(undefined)
    refresh()
  }

  const filters = [
    { key: "", label: "Todos" },
    { key: "zero", label: "Zerados" },
    { key: "min", label: "Est. mínimo" },
  ]

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input className="pl-8 h-9 w-56 text-sm" placeholder="Buscar produto..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilter(currentFilter, search)} />
          </div>
          {filters.map((f) => (
            <button key={f.key} onClick={() => applyFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${currentFilter === f.key ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Importar planilha
          </Button>
          <Button size="sm" onClick={() => { setEditProduct(undefined); setFormOpen(true) }}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo Produto
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Produto</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Categoria</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Estoque</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Mín / Máx</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Venda</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-gray-400">
                <p className="font-medium">Nenhum produto encontrado</p>
              </td></tr>
            ) : products.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                </td>
                <td className="px-4 py-3">
                  {p.category ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: p.category.color }}>
                      {p.category.name}
                    </span>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-bold tabular-nums ${p.currentStock === 0 ? "text-red-600" : p.currentStock <= p.minStock ? "text-yellow-600" : "text-gray-900"}`}>
                    {p.currentStock}
                  </span>
                  <span className="text-gray-400 text-xs ml-1">{p.unit}</span>
                </td>
                <td className="px-4 py-3 text-center text-xs text-gray-500 tabular-nums">
                  {p.minStock} / {p.maxStock}
                </td>
                <td className="px-4 py-3"><StockBadge p={p} /></td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {formatCurrency(p.salePrice ?? 0)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <button onClick={() => openMove(p, "IN")} title="Entrada" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openMove(p, "OUT")} title="Saída" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openMove(p, "ADJUSTMENT")} title="Ajuste" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditProduct(p); setFormOpen(true) }} title="Editar" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(p.id)} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={refresh} />

      <ProductFormSheet open={formOpen} onOpenChange={setFormOpen} product={editProduct}
        categories={categories} suppliers={suppliers} onSaved={refresh} />

      {moveProduct && (
        <MovementDialog open={!!moveProduct} onOpenChange={(o) => { if (!o) setMoveProduct(undefined) }}
          product={moveProduct} defaultType={moveType} onSaved={() => { setMoveProduct(undefined); refresh() }} />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar produto?</AlertDialogTitle>
            <AlertDialogDescription>O produto será marcado como inativo e não aparecerá mais na lista.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
