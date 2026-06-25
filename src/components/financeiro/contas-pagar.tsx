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
import { Plus, Search, CheckCircle2, Clock, AlertTriangle, XCircle, Trash2, ChevronDown, Check } from "lucide-react"
import { BILL_CATEGORIES } from "@/lib/financeiro-constants"

export { BILL_CATEGORIES }

type BillStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED"

interface BankAccount { id: string; name: string }
interface Bill {
  id: string; title: string; description: string | null; amount: number; dueDate: string
  paidAt: string | null; status: BillStatus; category: string; supplier: string | null
  recurring: boolean; bankAccount: BankAccount | null; createdAt: string
}

interface Props {
  initialBills: Bill[]
  bankAccounts: BankAccount[]
}


const STATUS_LABELS: Record<BillStatus, string> = { PENDING: "Pendente", PAID: "Pago", OVERDUE: "Vencida", CANCELLED: "Cancelada" }
const STATUS_COLORS: Record<BillStatus, string> = { PENDING: "bg-yellow-100 text-yellow-700", PAID: "bg-green-100 text-green-700", OVERDUE: "bg-red-100 text-red-700", CANCELLED: "bg-gray-100 text-gray-500" }
const STATUS_ICON: Record<BillStatus, React.ReactNode> = {
  PENDING: <Clock className="w-3.5 h-3.5" />, PAID: <CheckCircle2 className="w-3.5 h-3.5" />,
  OVERDUE: <AlertTriangle className="w-3.5 h-3.5" />, CANCELLED: <XCircle className="w-3.5 h-3.5" />,
}

const schema = z.object({
  title: z.string().min(1, "Obrigatório"),
  description: z.string().optional(),
  amount: z.coerce.number().positive("Valor obrigatório"),
  dueDate: z.string().min(1, "Obrigatório"),
  category: z.string().min(1, "Obrigatório"),
  supplier: z.string().optional(),
  recurring: z.boolean().default(false),
  bankAccountId: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function ContasPagar({ initialBills, bankAccounts }: Props) {
  const [bills, setBills] = useState(initialBills)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<BillStatus | "ALL">("ALL")
  const [createOpen, setCreateOpen] = useState(false)
  const [editBill, setEditBill] = useState<Bill | null>(null)
  const [deleteBill, setDeleteBill] = useState<Bill | null>(null)
  const [statusOpen, setStatusOpen] = useState<string | null>(null)

  const form = useForm<FormData>({ resolver: zodResolver(schema) as never })

  function openCreate() { form.reset({ recurring: false }); setCreateOpen(true) }
  function openEdit(b: Bill) {
    form.reset({ title: b.title, description: b.description ?? "", amount: b.amount, dueDate: b.dueDate.slice(0, 10), category: b.category, supplier: b.supplier ?? "", recurring: b.recurring, bankAccountId: b.bankAccount?.id ?? "" })
    setEditBill(b)
  }

  async function onSubmit(data: FormData) {
    const payload = { ...data, bankAccountId: data.bankAccountId || undefined }
    if (editBill) {
      const res = await fetch(`/api/financeiro/contas-pagar/${editBill.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (res.ok) { const updated = await res.json(); setBills((p) => p.map((b) => b.id === updated.id ? updated : b)); setEditBill(null) }
    } else {
      const res = await fetch("/api/financeiro/contas-pagar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (res.ok) { const created = await res.json(); setBills((p) => [created, ...p]); setCreateOpen(false) }
    }
  }

  async function markPaid(id: string) {
    const res = await fetch(`/api/financeiro/contas-pagar/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString() }) })
    if (res.ok) { const updated = await res.json(); setBills((p) => p.map((b) => b.id === id ? updated : b)) }
    setStatusOpen(null)
  }

  async function updateStatus(id: string, status: BillStatus) {
    const res = await fetch(`/api/financeiro/contas-pagar/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, ...(status === "PAID" ? { paidAt: new Date().toISOString() } : { paidAt: null }) }) })
    if (res.ok) { const updated = await res.json(); setBills((p) => p.map((b) => b.id === id ? updated : b)) }
    setStatusOpen(null)
  }

  async function confirmDelete() {
    if (!deleteBill) return
    await fetch(`/api/financeiro/contas-pagar/${deleteBill.id}`, { method: "DELETE" })
    setBills((p) => p.filter((b) => b.id !== deleteBill.id))
    setDeleteBill(null)
  }

  const filtered = bills.filter((b) => {
    if (filterStatus !== "ALL" && b.status !== filterStatus) return false
    if (search) { const q = search.toLowerCase(); return b.title.toLowerCase().includes(q) || (b.supplier?.toLowerCase().includes(q) ?? false) || b.category.toLowerCase().includes(q) }
    return true
  })

  const totals = { pending: bills.filter((b) => b.status === "PENDING").reduce((s, b) => s + b.amount, 0), paid: bills.filter((b) => b.status === "PAID").reduce((s, b) => s + b.amount, 0), overdue: bills.filter((b) => b.status === "OVERDUE").reduce((s, b) => s + b.amount, 0) }

  const FormSheet = ({ open, onClose, title }: { open: boolean; onClose: () => void; title: string }) => (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="mb-6"><SheetTitle>{title}</SheetTitle></SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
          <div className="space-y-1.5"><Label>Título *</Label><Input {...form.register("title")} placeholder="Ex: Aluguel março" />{form.formState.errors.title && <p className="text-red-500 text-xs">{form.formState.errors.title.message}</p>}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Valor *</Label><Input {...form.register("amount")} type="number" step="0.01" min="0" placeholder="0,00" />{form.formState.errors.amount && <p className="text-red-500 text-xs">{form.formState.errors.amount.message}</p>}</div>
            <div className="space-y-1.5"><Label>Vencimento *</Label><Input {...form.register("dueDate")} type="date" />{form.formState.errors.dueDate && <p className="text-red-500 text-xs">{form.formState.errors.dueDate.message}</p>}</div>
          </div>
          <div className="space-y-1.5"><Label>Categoria *</Label>
            <select {...form.register("category")} className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Selecione</option>
              {BILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {form.formState.errors.category && <p className="text-red-500 text-xs">{form.formState.errors.category.message}</p>}
          </div>
          <div className="space-y-1.5"><Label>Fornecedor / Credor</Label><Input {...form.register("supplier")} placeholder="Nome do fornecedor" /></div>
          {bankAccounts.length > 0 && (
            <div className="space-y-1.5"><Label>Conta de pagamento</Label>
              <select {...form.register("bankAccountId")} className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">— Nenhuma —</option>
                {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5"><Label>Descrição</Label><textarea {...form.register("description")} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" placeholder="Observações..." /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" {...form.register("recurring")} className="rounded" /> Conta recorrente</label>
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
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "A pagar", value: totals.pending, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", icon: <Clock className="w-4 h-4 text-yellow-600" /> },
          { label: "Vencidas", value: totals.overdue, color: "text-red-700", bg: "bg-red-50 border-red-200", icon: <AlertTriangle className="w-4 h-4 text-red-600" /> },
          { label: "Pagas este mês", value: totals.paid, color: "text-green-700", bg: "bg-green-50 border-green-200", icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className="flex items-center justify-between mb-1">{s.icon}<span className={`text-xs font-medium ${s.color}`}>{s.label}</span></div>
            <p className={`text-xl font-bold ${s.color}`}>{formatCurrency(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" /><Input className="pl-8 h-9 w-52 text-sm" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as never)} className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="ALL">Todos</option>
            {(["PENDING", "OVERDUE", "PAID", "CANCELLED"] as BillStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" /> Nova conta</Button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 bg-gray-50">
            {["Título / Categoria", "Fornecedor", "Valor", "Vencimento", "Status", "Ações"].map((h) => (
              <th key={h} className={`px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide ${h === "Ações" ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-14 text-gray-400">Nenhuma conta encontrada</td></tr>
            ) : filtered.map((b) => (
              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(b)} className="text-left">
                    <p className="font-medium text-gray-900">{b.title}{b.recurring && <span className="ml-1.5 text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Recorrente</span>}</p>
                    <p className="text-xs text-gray-400">{b.category}</p>
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">{b.supplier ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(b.amount)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{new Date(b.dueDate).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <div className="relative">
                    <button onClick={() => setStatusOpen(statusOpen === b.id ? null : b.id)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[b.status]}`}>
                      {STATUS_ICON[b.status]}{STATUS_LABELS[b.status]}<ChevronDown className="w-3 h-3" />
                    </button>
                    {statusOpen === b.id && (
                      <div className="absolute z-10 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
                        {(["PENDING", "PAID", "OVERDUE", "CANCELLED"] as BillStatus[]).map((s) => (
                          <button key={s} onClick={() => s === "PAID" ? markPaid(b.id) : updateStatus(b.id, s)} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${b.status === s ? "font-semibold" : ""}`}>{STATUS_LABELS[s]}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {b.status !== "PAID" && b.status !== "CANCELLED" && (
                      <button onClick={() => markPaid(b.id)} title="Marcar como pago" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Check className="w-3.5 h-3.5" /></button>
                    )}
                    <button onClick={() => setDeleteBill(b)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Nova Conta a Pagar" />
      <FormSheet open={!!editBill} onClose={() => setEditBill(null)} title="Editar Conta a Pagar" />

      <AlertDialog open={!!deleteBill} onOpenChange={(o) => !o && setDeleteBill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir conta?</AlertDialogTitle><AlertDialogDescription>"{deleteBill?.title}" será excluída permanentemente.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {statusOpen && <div className="fixed inset-0 z-0" onClick={() => setStatusOpen(null)} />}
    </div>
  )
}
