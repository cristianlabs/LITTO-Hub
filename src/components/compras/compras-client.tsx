"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { formatCurrency, timeAgo } from "@/lib/utils"
import { Plus, Trash2, Search, ShoppingCart, Package, CheckCircle2, XCircle, ExternalLink, ChevronDown, Building2 } from "lucide-react"
import Link from "next/link"
import type { PurchaseOrderStatus } from "@prisma/client"
import { FornecedoresTab } from "./fornecedores-tab"

interface OrderItem {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
}

interface Requisition {
  id: string
  title: string
  status: string
}

interface PurchaseOrder {
  id: string
  number: string
  title: string
  supplier: string | null
  totalValue: number
  status: PurchaseOrderStatus
  notes: string | null
  orderedAt: string | null
  receivedAt: string | null
  createdAt: string
  requisitionId: string | null
  requisition: Requisition | null
  createdBy: { id: string; name: string | null }
  items: OrderItem[]
}

interface Supplier {
  id: string; name: string; cnpj: string | null; email: string | null
  phone: string | null; contact: string | null
  _count: { products: number }
  purchaseOrders: { id: string; number: string; title: string; totalValue: number; status: string }[]
}

interface Props {
  initialOrders: PurchaseOrder[]
  pendingRequisitions: Requisition[]
  suppliers: Supplier[]
  canManage: boolean
}

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  PENDING: "Pendente",
  ORDERED: "Pedido feito",
  PARTIAL: "Parcialmente recebido",
  RECEIVED: "Recebido",
  CANCELLED: "Cancelado",
}

const STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  ORDERED: "bg-blue-100 text-blue-700",
  PARTIAL: "bg-purple-100 text-purple-700",
  RECEIVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
}

const STATUSES: PurchaseOrderStatus[] = ["PENDING", "ORDERED", "PARTIAL", "RECEIVED", "CANCELLED"]

const itemSchema = z.object({
  description: z.string().min(1, "Obrigatório"),
  quantity: z.coerce.number().int().min(1),
  unit: z.string().default("un"),
  unitPrice: z.coerce.number().min(0),
})

const schema = z.object({
  title: z.string().min(1, "Obrigatório"),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  requisitionId: z.string().optional(),
  items: z.array(itemSchema).min(1, "Adicione ao menos um item"),
})

type FormData = z.infer<typeof schema>

export function ComprasClient({ initialOrders, pendingRequisitions, suppliers, canManage }: Props) {
  const [tab, setTab] = useState<"pedidos" | "fornecedores">("pedidos")
  const [orders, setOrders] = useState(initialOrders)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<PurchaseOrderStatus | "ALL">("ALL")
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedReqId, setSelectedReqId] = useState("")
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null)
  const [deleteOrder, setDeleteOrder] = useState<PurchaseOrder | null>(null)
  const [statusOpen, setStatusOpen] = useState<string | null>(null)

  const { register, handleSubmit, reset, control, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { items: [{ description: "", quantity: 1, unit: "un", unitPrice: 0 }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const watchedItems = watch("items")
  const total = watchedItems?.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0) ?? 0

  function openCreateFromReq(req: Requisition) {
    reset({ title: req.title, requisitionId: req.id, items: [{ description: req.title, quantity: 1, unit: "un", unitPrice: 0 }] })
    setSelectedReqId(req.id)
    setCreateOpen(true)
  }

  async function onSubmit(data: FormData) {
    const res = await fetch("/api/compras", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const order = await res.json()
      setOrders((prev) => [order, ...prev.filter((o) => o.requisitionId !== data.requisitionId)])
      setCreateOpen(false)
      reset({ items: [{ description: "", quantity: 1, unit: "un", unitPrice: 0 }] })
    } else {
      alert("Erro ao criar pedido")
    }
  }

  async function updateStatus(id: string, status: PurchaseOrderStatus) {
    const res = await fetch(`/api/compras/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setOrders((prev) => prev.map((o) => o.id === id ? updated : o))
      if (viewOrder?.id === id) setViewOrder(updated)
    }
    setStatusOpen(null)
  }

  async function confirmDelete() {
    if (!deleteOrder) return
    await fetch(`/api/compras/${deleteOrder.id}`, { method: "DELETE" })
    setOrders((prev) => prev.filter((o) => o.id !== deleteOrder.id))
    setDeleteOrder(null)
    if (viewOrder?.id === deleteOrder.id) setViewOrder(null)
  }

  const filtered = orders.filter((o) => {
    if (filterStatus !== "ALL" && o.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return o.title.toLowerCase().includes(q) || o.number.toLowerCase().includes(q) || (o.supplier?.toLowerCase().includes(q) ?? false)
    }
    return true
  })

  const kpis = [
    { label: "Total de pedidos", value: orders.length, icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pendentes", value: orders.filter((o) => o.status === "PENDING").length, icon: Package, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Pedidos feitos", value: orders.filter((o) => o.status === "ORDERED").length, icon: ExternalLink, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Recebidos", value: orders.filter((o) => o.status === "RECEIVED").length, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab("pedidos")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "pedidos" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <ShoppingCart className="w-4 h-4" /> Pedidos de Compra
        </button>
        <button onClick={() => setTab("fornecedores")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "fornecedores" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <Building2 className="w-4 h-4" /> Fornecedores
        </button>
      </div>

      {tab === "fornecedores" && <FornecedoresTab initialSuppliers={suppliers} />}
      {tab === "pedidos" && <>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{k.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${k.color}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Requisições pendentes de compra */}
      {pendingRequisitions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-3">
            {pendingRequisitions.length} requisição{pendingRequisitions.length !== 1 ? "ões" : ""} de compra aprovada{pendingRequisitions.length !== 1 ? "s" : ""} aguardando pedido
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingRequisitions.map((r) => (
              <button key={r.id} onClick={() => canManage && openCreateFromReq(r)}
                className="flex items-center gap-1.5 bg-white border border-amber-200 text-amber-800 text-xs px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors font-medium">
                <ShoppingCart className="w-3.5 h-3.5" />
                {r.title}
                <ExternalLink className="w-3 h-3 opacity-50" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input className="pl-8 h-9 w-56 text-sm" placeholder="Buscar pedido..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as never)}
            className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="ALL">Todos os status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { reset({ items: [{ description: "", quantity: 1, unit: "un", unitPrice: 0 }] }); setSelectedReqId(""); setCreateOpen(true) }}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo pedido
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Pedido</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Fornecedor</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Valor Total</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Requisição</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Criado</th>
              {canManage && <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-14 text-gray-400">Nenhum pedido encontrado</td></tr>
            ) : filtered.map((o) => (
              <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <button onClick={() => setViewOrder(o)} className="text-left hover:underline">
                    <p className="font-medium text-gray-900">{o.title}</p>
                    <p className="text-xs text-gray-400 font-mono">{o.number}</p>
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-600">{o.supplier ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(o.totalValue)}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <div className="relative">
                      <button onClick={() => setStatusOpen(statusOpen === o.id ? null : o.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                        {STATUS_LABELS[o.status]} <ChevronDown className="w-3 h-3" />
                      </button>
                      {statusOpen === o.id && (
                        <div className="absolute z-10 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[170px]">
                          {STATUSES.map((s) => (
                            <button key={s} onClick={() => updateStatus(o.id, s)}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${o.status === s ? "font-semibold" : ""}`}>
                              {STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {o.requisition ? (
                    <Link href="/requisicoes" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      {o.requisition.title.slice(0, 24)}{o.requisition.title.length > 24 ? "…" : ""}
                    </Link>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(o.createdAt)}</td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => setDeleteOrder(o)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View order sheet */}
      <Sheet open={!!viewOrder} onOpenChange={(o) => !o && setViewOrder(null)}>
        <SheetContent className="sm:max-w-lg">
          {viewOrder && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle>{viewOrder.title}</SheetTitle>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{viewOrder.number}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[viewOrder.status]}`}>
                    {STATUS_LABELS[viewOrder.status]}
                  </span>
                </div>
              </SheetHeader>
              <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                {viewOrder.supplier && (
                  <div><p className="text-xs text-gray-500">Fornecedor</p><p className="font-medium">{viewOrder.supplier}</p></div>
                )}
                {viewOrder.requisition && (
                  <div>
                    <p className="text-xs text-gray-500">Requisição vinculada</p>
                    <Link href="/requisicoes" className="text-sm text-blue-600 hover:underline">{viewOrder.requisition.title}</Link>
                  </div>
                )}
                {viewOrder.notes && (
                  <div><p className="text-xs text-gray-500">Notas</p><p className="text-sm text-gray-700">{viewOrder.notes}</p></div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-2">Itens do pedido</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Descrição</th>
                          <th className="text-center px-3 py-2 text-xs text-gray-500 font-medium">Qtd</th>
                          <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Unit.</th>
                          <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewOrder.items.map((item) => (
                          <tr key={item.id} className="border-b border-gray-50">
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2 text-center">{item.quantity} {item.unit}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-semibold">
                          <td colSpan={3} className="px-3 py-2 text-right text-sm">Total</td>
                          <td className="px-3 py-2 text-right text-sm">{formatCurrency(viewOrder.totalValue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                {canManage && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Atualizar status</p>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.filter((s) => s !== viewOrder.status).map((s) => (
                        <button key={s} onClick={() => updateStatus(viewOrder.id, s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${STATUS_COLORS[s]} hover:opacity-80`}>
                          → {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create order sheet */}
      <Sheet open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader className="mb-6"><SheetTitle>Novo Pedido de Compra</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
            {selectedReqId && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                <ShoppingCart className="w-3.5 h-3.5" />
                Baseado em requisição aprovada
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input {...register("title")} placeholder="Descrição geral do pedido" />
              {errors.title && <p className="text-red-500 text-xs">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input {...register("supplier")} placeholder="Nome do fornecedor" />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <textarea {...register("notes")} rows={2}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Observações para o pedido..." />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens *</Label>
                <button type="button" onClick={() => append({ description: "", quantity: 1, unit: "un", unitPrice: 0 })}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Adicionar item
                </button>
              </div>
              {errors.items && <p className="text-red-500 text-xs">{errors.items.message as string}</p>}
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-12 gap-1.5 items-start">
                    <div className="col-span-5">
                      <Input {...register(`items.${idx}.description`)} placeholder="Descrição" className="h-8 text-xs" />
                    </div>
                    <div className="col-span-2">
                      <Input {...register(`items.${idx}.quantity`)} type="number" min={1} placeholder="Qtd" className="h-8 text-xs" />
                    </div>
                    <div className="col-span-2">
                      <Input {...register(`items.${idx}.unit`)} placeholder="Un" className="h-8 text-xs" />
                    </div>
                    <div className="col-span-2">
                      <Input {...register(`items.${idx}.unitPrice`)} type="number" min={0} step="0.01" placeholder="Preço" className="h-8 text-xs" />
                    </div>
                    <div className="col-span-1 flex justify-center pt-1.5">
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(idx)}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-right text-sm font-semibold text-gray-700 pt-1">
                Total: {formatCurrency(total)}
              </div>
            </div>
            <SheetFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Criando..." : "Criar pedido"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteOrder} onOpenChange={(o) => !o && setDeleteOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteOrder?.title}" ({deleteOrder?.number}) será excluído permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Click outside status dropdown */}
      {statusOpen && <div className="fixed inset-0 z-0" onClick={() => setStatusOpen(null)} />}
      </>}
    </div>
  )
}
