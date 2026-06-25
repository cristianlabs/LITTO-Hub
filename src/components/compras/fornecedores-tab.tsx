"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { formatCurrency } from "@/lib/utils"
import { Plus, Search, Building2, Pencil, Trash2, Package, ShoppingCart, Phone, Mail, FileText } from "lucide-react"

interface PurchaseOrderRef { id: string; number: string; title: string; totalValue: number; status: string }
interface Supplier {
  id: string; name: string; cnpj: string | null; email: string | null
  phone: string | null; contact: string | null
  _count: { products: number }
  purchaseOrders: PurchaseOrderRef[]
}

interface Props { initialSuppliers: Supplier[] }

const STATUS_LABELS: Record<string, string> = { PENDING: "Pendente", ORDERED: "Pedido feito", PARTIAL: "Parcial", RECEIVED: "Recebido", CANCELLED: "Cancelado" }
const STATUS_COLORS: Record<string, string> = { PENDING: "bg-yellow-100 text-yellow-700", ORDERED: "bg-blue-100 text-blue-700", PARTIAL: "bg-purple-100 text-purple-700", RECEIVED: "bg-green-100 text-green-700", CANCELLED: "bg-gray-100 text-gray-500" }

const schema = z.object({
  name: z.string().min(1, "Obrigatório"),
  cnpj: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  contact: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function FornecedoresTab({ initialSuppliers }: Props) {
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null)
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null)
  const [deleteError, setDeleteError] = useState("")

  const form = useForm<FormData>({ resolver: zodResolver(schema) as never })

  function openCreate() { form.reset(); setCreateOpen(true) }
  function openEdit(s: Supplier) {
    form.reset({ name: s.name, cnpj: s.cnpj ?? "", email: s.email ?? "", phone: s.phone ?? "", contact: s.contact ?? "" })
    setEditSupplier(s)
  }

  async function onSubmit(data: FormData) {
    const payload = { ...data, email: data.email || null }
    if (editSupplier) {
      const res = await fetch("/api/estoque/fornecedores", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editSupplier.id, ...payload }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSuppliers((p) => p.map((s) => s.id === editSupplier.id ? { ...s, ...updated } : s))
        if (viewSupplier?.id === editSupplier.id) setViewSupplier((v) => v ? { ...v, ...updated } : v)
        setEditSupplier(null)
      }
    } else {
      const res = await fetch("/api/estoque/fornecedores", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const created = await res.json()
        setSuppliers((p) => [...p, { ...created, _count: { products: 0 }, purchaseOrders: [] }])
        setCreateOpen(false)
      }
    }
  }

  async function confirmDelete() {
    if (!deleteSupplier) return
    setDeleteError("")
    const res = await fetch(`/api/estoque/fornecedores?id=${deleteSupplier.id}`, { method: "DELETE" })
    if (res.ok) {
      setSuppliers((p) => p.filter((s) => s.id !== deleteSupplier.id))
      if (viewSupplier?.id === deleteSupplier.id) setViewSupplier(null)
      setDeleteSupplier(null)
    } else {
      const err = await res.json()
      setDeleteError(err.error ?? "Erro ao excluir. Verifique se há produtos vinculados.")
    }
  }

  const filtered = suppliers.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || (s.cnpj?.includes(q) ?? false) || (s.email?.toLowerCase().includes(q) ?? false) || (s.contact?.toLowerCase().includes(q) ?? false)
  })

  const kpis = [
    { label: "Fornecedores ativos", value: suppliers.length, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Produtos cadastrados", value: suppliers.reduce((s, f) => s + f._count.products, 0), icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Pedidos vinculados", value: suppliers.reduce((s, f) => s + f.purchaseOrders.length, 0), icon: ShoppingCart, color: "text-green-600", bg: "bg-green-50" },
    { label: "Volume total pago", value: formatCurrency(suppliers.flatMap((f) => f.purchaseOrders).filter((o) => o.status === "RECEIVED").reduce((s, o) => s + o.totalValue, 0)), icon: FileText, color: "text-orange-600", bg: "bg-orange-50" },
  ]

  const FormSheet = ({ open, onClose, title }: { open: boolean; onClose: () => void; title: string }) => (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="mb-6"><SheetTitle>{title}</SheetTitle></SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome / Razão Social *</Label>
            <Input {...form.register("name")} placeholder="Nome da empresa" />
            {form.formState.errors.name && <p className="text-red-500 text-xs">{form.formState.errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>CNPJ</Label><Input {...form.register("cnpj")} placeholder="00.000.000/0001-00" /></div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input {...form.register("phone")} placeholder="(11) 99999-9999" /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input {...form.register("email")} type="email" placeholder="contato@empresa.com" />
            {form.formState.errors.email && <p className="text-red-500 text-xs">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-1.5"><Label>Contato / Responsável</Label><Input {...form.register("contact")} placeholder="Nome do responsável comercial" /></div>
          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Salvando..." : "Salvar"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )

  return (
    <div className="space-y-5">
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

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input className="pl-8 h-9 w-64 text-sm" placeholder="Buscar fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" /> Novo fornecedor</Button>
      </div>

      {/* Grid of supplier cards */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-16 text-center text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          {search ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const totalVolume = s.purchaseOrders.reduce((sum, o) => sum + o.totalValue, 0)
            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                    {s.cnpj && <p className="text-xs text-gray-400 font-mono">{s.cnpj}</p>}
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {s.contact && (
                    <p className="text-xs text-gray-600 flex items-center gap-1.5">
                      <span className="text-gray-400">Contato:</span> {s.contact}
                    </p>
                  )}
                  {s.phone && (
                    <p className="text-xs text-gray-600 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-gray-400" /> {s.phone}
                    </p>
                  )}
                  {s.email && (
                    <p className="text-xs text-gray-600 flex items-center gap-1.5 truncate">
                      <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" /> {s.email}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-sm font-bold text-gray-900">{s._count.products}</p>
                    <p className="text-[10px] text-gray-400">Produtos</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-sm font-bold text-gray-900">{s.purchaseOrders.length}</p>
                    <p className="text-[10px] text-gray-400">Pedidos</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-sm font-bold text-gray-900 truncate px-1">{totalVolume > 0 ? formatCurrency(totalVolume).replace("R$ ", "") : "—"}</p>
                    <p className="text-[10px] text-gray-400">Volume</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <button onClick={() => setViewSupplier(s)} className="text-xs text-blue-600 hover:underline">Ver detalhes</button>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setDeleteError(""); setDeleteSupplier(s) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* View detail sheet */}
      <Sheet open={!!viewSupplier} onOpenChange={(o) => !o && setViewSupplier(null)}>
        <SheetContent className="sm:max-w-lg">
          {viewSupplier && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <SheetTitle>{viewSupplier.name}</SheetTitle>
                    {viewSupplier.cnpj && <p className="text-xs text-gray-400 font-mono">{viewSupplier.cnpj}</p>}
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
                {/* Contact info */}
                <div className="grid grid-cols-2 gap-3">
                  {viewSupplier.contact && <div><p className="text-xs text-gray-500">Responsável</p><p className="font-medium text-sm mt-0.5">{viewSupplier.contact}</p></div>}
                  {viewSupplier.phone && <div><p className="text-xs text-gray-500">Telefone</p><p className="font-medium text-sm mt-0.5">{viewSupplier.phone}</p></div>}
                  {viewSupplier.email && <div className="col-span-2"><p className="text-xs text-gray-500">Email</p><p className="font-medium text-sm mt-0.5">{viewSupplier.email}</p></div>}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Produtos", value: viewSupplier._count.products },
                    { label: "Pedidos", value: viewSupplier.purchaseOrders.length },
                    { label: "Recebidos", value: viewSupplier.purchaseOrders.filter((o) => o.status === "RECEIVED").length },
                  ].map((k) => (
                    <div key={k.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-gray-900">{k.value}</p>
                      <p className="text-xs text-gray-500">{k.label}</p>
                    </div>
                  ))}
                </div>

                {/* Purchase orders */}
                {viewSupplier.purchaseOrders.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Histórico de pedidos</p>
                    <div className="space-y-2">
                      {viewSupplier.purchaseOrders.map((o) => (
                        <div key={o.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{o.title}</p>
                            <p className="text-xs text-gray-400 font-mono">{o.number}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-semibold text-gray-900">{formatCurrency(o.totalValue)}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-500"}`}>{STATUS_LABELS[o.status] ?? o.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Button size="sm" onClick={() => { setViewSupplier(null); openEdit(viewSupplier) }}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { setDeleteError(""); setDeleteSupplier(viewSupplier) }}>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <FormSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Novo Fornecedor" />
      <FormSheet open={!!editSupplier} onClose={() => setEditSupplier(null)} title="Editar Fornecedor" />

      <AlertDialog open={!!deleteSupplier} onOpenChange={(o) => !o && setDeleteSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteSupplier?.name}" será excluído permanentemente. Isso não é possível se houver produtos vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg mx-6">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
