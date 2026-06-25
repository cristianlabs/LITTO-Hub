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
import { Plus, Search, CheckCircle2, Clock, AlertTriangle, XCircle, Trash2, ChevronDown, ArrowDownCircle } from "lucide-react"
import { RECEIVABLE_CATEGORIES } from "@/lib/financeiro-constants"

export { RECEIVABLE_CATEGORIES }

type ReceivableStatus = "PENDING" | "RECEIVED" | "OVERDUE" | "CANCELLED"

interface BankAccount { id: string; name: string }
interface ContactRef { id: string; name: string }
interface Receivable {
  id: string; title: string; description: string | null; amount: number; dueDate: string
  receivedAt: string | null; status: ReceivableStatus; category: string; client: string | null
  contact: ContactRef | null; bankAccount: BankAccount | null; createdAt: string
}

interface Props {
  initialReceivables: Receivable[]
  bankAccounts: BankAccount[]
}


const STATUS_LABELS: Record<ReceivableStatus, string> = { PENDING: "Pendente", RECEIVED: "Recebido", OVERDUE: "Vencida", CANCELLED: "Cancelada" }
const STATUS_COLORS: Record<ReceivableStatus, string> = { PENDING: "bg-yellow-100 text-yellow-700", RECEIVED: "bg-green-100 text-green-700", OVERDUE: "bg-red-100 text-red-700", CANCELLED: "bg-gray-100 text-gray-500" }

const schema = z.object({
  title: z.string().min(1, "Obrigatório"),
  description: z.string().optional(),
  amount: z.coerce.number().positive("Valor obrigatório"),
  dueDate: z.string().min(1, "Obrigatório"),
  category: z.string().min(1, "Obrigatório"),
  client: z.string().optional(),
  bankAccountId: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function ContasReceber({ initialReceivables, bankAccounts }: Props) {
  const [items, setItems] = useState(initialReceivables)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<ReceivableStatus | "ALL">("ALL")
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<Receivable | null>(null)
  const [deleteItem, setDeleteItem] = useState<Receivable | null>(null)
  const [statusOpen, setStatusOpen] = useState<string | null>(null)

  const form = useForm<FormData>({ resolver: zodResolver(schema) as never })

  function openCreate() { form.reset(); setCreateOpen(true) }
  function openEdit(r: Receivable) {
    form.reset({ title: r.title, description: r.description ?? "", amount: r.amount, dueDate: r.dueDate.slice(0, 10), category: r.category, client: r.client ?? "", bankAccountId: r.bankAccount?.id ?? "" })
    setEditItem(r)
  }

  async function onSubmit(data: FormData) {
    const payload = { ...data, bankAccountId: data.bankAccountId || undefined }
    if (editItem) {
      const res = await fetch(`/api/financeiro/contas-receber/${editItem.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (res.ok) { const updated = await res.json(); setItems((p) => p.map((r) => r.id === updated.id ? updated : r)); setEditItem(null) }
    } else {
      const res = await fetch("/api/financeiro/contas-receber", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (res.ok) { const created = await res.json(); setItems((p) => [created, ...p]); setCreateOpen(false) }
    }
  }

  async function markReceived(id: string) {
    const res = await fetch(`/api/financeiro/contas-receber/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "RECEIVED", receivedAt: new Date().toISOString() }) })
    if (res.ok) { const updated = await res.json(); setItems((p) => p.map((r) => r.id === id ? updated : r)) }
    setStatusOpen(null)
  }

  async function updateStatus(id: string, status: ReceivableStatus) {
    const res = await fetch(`/api/financeiro/contas-receber/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, ...(status === "RECEIVED" ? { receivedAt: new Date().toISOString() } : { receivedAt: null }) }) })
    if (res.ok) { const updated = await res.json(); setItems((p) => p.map((r) => r.id === id ? updated : r)) }
    setStatusOpen(null)
  }

  async function confirmDelete() {
    if (!deleteItem) return
    await fetch(`/api/financeiro/contas-receber/${deleteItem.id}`, { method: "DELETE" })
    setItems((p) => p.filter((r) => r.id !== deleteItem.id))
    setDeleteItem(null)
  }

  const filtered = items.filter((r) => {
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false
    if (search) { const q = search.toLowerCase(); return r.title.toLowerCase().includes(q) || (r.client?.toLowerCase().includes(q) ?? false) || r.category.toLowerCase().includes(q) }
    return true
  })

  const totals = {
    pending: items.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.amount, 0),
    received: items.filter((r) => r.status === "RECEIVED").reduce((s, r) => s + r.amount, 0),
    overdue: items.filter((r) => r.status === "OVERDUE").reduce((s, r) => s + r.amount, 0),
  }

  const FormSheet = ({ open, onClose, title }: { open: boolean; onClose: () => void; title: string }) => (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="mb-6"><SheetTitle>{title}</SheetTitle></SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
          <div className="space-y-1.5"><Label>Título *</Label><Input {...form.register("title")} placeholder="Ex: Fatura cliente ABC" />{form.formState.errors.title && <p className="text-red-500 text-xs">{form.formState.errors.title.message}</p>}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Valor *</Label><Input {...form.register("amount")} type="number" step="0.01" min="0" placeholder="0,00" /></div>
            <div className="space-y-1.5"><Label>Vencimento *</Label><Input {...form.register("dueDate")} type="date" /></div>
          </div>
          <div className="space-y-1.5"><Label>Categoria *</Label>
            <select {...form.register("category")} className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Selecione</option>
              {RECEIVABLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Cliente / Devedor</Label><Input {...form.register("client")} placeholder="Nome do cliente" /></div>
          {bankAccounts.length > 0 && (
            <div className="space-y-1.5"><Label>Conta de recebimento</Label>
              <select {...form.register("bankAccountId")} className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">— Nenhuma —</option>
                {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5"><Label>Descrição</Label><textarea {...form.register("description")} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" placeholder="Observações..." /></div>
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
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "A receber", value: totals.pending, color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: <Clock className="w-4 h-4 text-blue-600" /> },
          { label: "Vencidas", value: totals.overdue, color: "text-red-700", bg: "bg-red-50 border-red-200", icon: <AlertTriangle className="w-4 h-4 text-red-600" /> },
          { label: "Recebido este mês", value: totals.received, color: "text-green-700", bg: "bg-green-50 border-green-200", icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className="flex items-center justify-between mb-1">{s.icon}<span className={`text-xs font-medium ${s.color}`}>{s.label}</span></div>
            <p className={`text-xl font-bold ${s.color}`}>{formatCurrency(s.value)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" /><Input className="pl-8 h-9 w-52 text-sm" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as never)} className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="ALL">Todos</option>
            {(["PENDING", "OVERDUE", "RECEIVED", "CANCELLED"] as ReceivableStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" /> Nova conta</Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 bg-gray-50">
            {["Título / Categoria", "Cliente", "Valor", "Vencimento", "Status", "Ações"].map((h) => (
              <th key={h} className={`px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide ${h === "Ações" ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-14 text-gray-400">Nenhuma conta encontrada</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(r)} className="text-left">
                    <p className="font-medium text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-400">{r.category}</p>
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">{r.client ?? r.contact?.name ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(r.amount)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{new Date(r.dueDate).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <div className="relative">
                    <button onClick={() => setStatusOpen(statusOpen === r.id ? null : r.id)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}<ChevronDown className="w-3 h-3" />
                    </button>
                    {statusOpen === r.id && (
                      <div className="absolute z-10 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
                        {(["PENDING", "RECEIVED", "OVERDUE", "CANCELLED"] as ReceivableStatus[]).map((s) => (
                          <button key={s} onClick={() => s === "RECEIVED" ? markReceived(r.id) : updateStatus(r.id, s)} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${r.status === s ? "font-semibold" : ""}`}>{STATUS_LABELS[s]}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {r.status !== "RECEIVED" && r.status !== "CANCELLED" && (
                      <button onClick={() => markReceived(r.id)} title="Marcar como recebido" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"><ArrowDownCircle className="w-3.5 h-3.5" /></button>
                    )}
                    <button onClick={() => setDeleteItem(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Nova Conta a Receber" />
      <FormSheet open={!!editItem} onClose={() => setEditItem(null)} title="Editar Conta a Receber" />

      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir conta?</AlertDialogTitle><AlertDialogDescription>"{deleteItem?.title}" será excluída permanentemente.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {statusOpen && <div className="fixed inset-0 z-0" onClick={() => setStatusOpen(null)} />}
    </div>
  )
}
