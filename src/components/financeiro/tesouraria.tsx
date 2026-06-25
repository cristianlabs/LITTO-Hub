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
import { Plus, Pencil, Trash2, Landmark, ArrowUpCircle, ArrowDownCircle, TrendingUp, Wallet } from "lucide-react"

type BankAccountType = "CHECKING" | "SAVINGS" | "INVESTMENT" | "CASH"

interface BankAccount { id: string; name: string; bank: string | null; agency: string | null; account: string | null; type: BankAccountType; balance: number; active: boolean }
interface DailyFlow { day: number; saidas: number; entradas: number }
interface FlowData {
  totalBalance: number
  projectedBalance: number
  bills: { total: number; paid: number; pending: number; count: number }
  receivables: { total: number; received: number; pending: number; count: number }
  dailyFlow: DailyFlow[]
  bankAccounts: BankAccount[]
}

interface Props {
  initialAccounts: BankAccount[]
  initialFlow: FlowData
}

const TYPE_LABELS: Record<BankAccountType, string> = { CHECKING: "Conta Corrente", SAVINGS: "Poupança", INVESTMENT: "Investimento", CASH: "Caixa" }
const TYPE_COLORS: Record<BankAccountType, string> = { CHECKING: "bg-blue-50 text-blue-700", SAVINGS: "bg-green-50 text-green-700", INVESTMENT: "bg-purple-50 text-purple-700", CASH: "bg-orange-50 text-orange-700" }

const schema = z.object({
  name: z.string().min(1, "Obrigatório"),
  bank: z.string().optional(),
  agency: z.string().optional(),
  account: z.string().optional(),
  type: z.enum(["CHECKING", "SAVINGS", "INVESTMENT", "CASH"]).default("CHECKING"),
  balance: z.coerce.number().default(0),
})
type FormData = z.infer<typeof schema>

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

export function Tesouraria({ initialAccounts, initialFlow }: Props) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [flow, setFlow] = useState(initialFlow)
  const [flowMonth, setFlowMonth] = useState(new Date().getMonth() + 1)
  const [flowYear, setFlowYear] = useState(new Date().getFullYear())
  const [createOpen, setCreateOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null)
  const [deleteAccount, setDeleteAccount] = useState<BankAccount | null>(null)
  const [loadingFlow, setLoadingFlow] = useState(false)

  const form = useForm<FormData>({ resolver: zodResolver(schema) as never })

  function openCreate() { form.reset({ type: "CHECKING", balance: 0 }); setCreateOpen(true) }
  function openEdit(a: BankAccount) { form.reset({ name: a.name, bank: a.bank ?? "", agency: a.agency ?? "", account: a.account ?? "", type: a.type, balance: a.balance }); setEditAccount(a) }

  async function onSubmit(data: FormData) {
    if (editAccount) {
      const res = await fetch(`/api/financeiro/banco/${editAccount.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (res.ok) { const updated = await res.json(); setAccounts((p) => p.map((a) => a.id === updated.id ? updated : a)); setEditAccount(null) }
    } else {
      const res = await fetch("/api/financeiro/banco", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (res.ok) { const created = await res.json(); setAccounts((p) => [...p, created]); setCreateOpen(false) }
    }
  }

  async function confirmDelete() {
    if (!deleteAccount) return
    await fetch(`/api/financeiro/banco/${deleteAccount.id}`, { method: "DELETE" })
    setAccounts((p) => p.filter((a) => a.id !== deleteAccount.id))
    setDeleteAccount(null)
  }

  async function loadFlow(y: number, m: number) {
    setLoadingFlow(true)
    const res = await fetch(`/api/financeiro/fluxo?year=${y}&month=${m}`)
    if (res.ok) { const data = await res.json(); setFlow(data) }
    setLoadingFlow(false)
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const maxFlow = Math.max(...flow.dailyFlow.map((d) => Math.max(d.entradas, d.saidas)), 1)

  const FormSheet = ({ open, onClose, title }: { open: boolean; onClose: () => void; title: string }) => (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="mb-6"><SheetTitle>{title}</SheetTitle></SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5"><Label>Nome da conta *</Label><Input {...form.register("name")} placeholder="Ex: Banco do Brasil - PJ" />{form.formState.errors.name && <p className="text-red-500 text-xs">{form.formState.errors.name.message}</p>}</div>
          <div className="space-y-1.5"><Label>Tipo</Label>
            <select {...form.register("type")} className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {(["CHECKING", "SAVINGS", "INVESTMENT", "CASH"] as BankAccountType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Banco</Label><Input {...form.register("bank")} placeholder="Nome do banco" /></div>
            <div className="space-y-1.5"><Label>Agência</Label><Input {...form.register("agency")} placeholder="0000" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Conta</Label><Input {...form.register("account")} placeholder="00000-0" /></div>
            <div className="space-y-1.5"><Label>Saldo atual</Label><Input {...form.register("balance")} type="number" step="0.01" placeholder="0,00" /></div>
          </div>
          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Salvando..." : "Salvar"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Saldo total", value: formatCurrency(totalBalance), icon: <Wallet className="w-5 h-5 text-blue-600" />, bg: "bg-blue-50", border: "border-blue-100" },
          { label: "Saldo projetado", value: formatCurrency(flow.projectedBalance), icon: <TrendingUp className="w-5 h-5 text-purple-600" />, bg: "bg-purple-50", border: "border-purple-100" },
          { label: "Saídas previstas", value: formatCurrency(flow.bills.pending), icon: <ArrowUpCircle className="w-5 h-5 text-red-500" />, bg: "bg-red-50", border: "border-red-100" },
          { label: "Entradas previstas", value: formatCurrency(flow.receivables.pending), icon: <ArrowDownCircle className="w-5 h-5 text-green-600" />, bg: "bg-green-50", border: "border-green-100" },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl border ${k.border} p-5`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium">{k.label}</p>
              <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center`}>{k.icon}</div>
            </div>
            <p className="text-xl font-bold text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Bank accounts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Landmark className="w-4 h-4 text-gray-500" /> Contas Bancárias</h3>
          <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" /> Nova conta</Button>
        </div>
        {accounts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-14 text-center text-gray-400">
            <Landmark className="w-8 h-8 mx-auto mb-2 text-gray-200" />Nenhuma conta cadastrada
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((a) => (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{a.name}</p>
                    {a.bank && <p className="text-xs text-gray-400 mt-0.5">{a.bank}{a.agency ? ` · Ag. ${a.agency}` : ""}{a.account ? ` · CC ${a.account}` : ""}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[a.type]}`}>{TYPE_LABELS[a.type]}</span>
                </div>
                <p className={`text-2xl font-bold ${a.balance < 0 ? "text-red-600" : "text-gray-900"}`}>{formatCurrency(a.balance)}</p>
                <div className="flex items-center gap-1 mt-3 justify-end">
                  <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleteAccount(a)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cash flow chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-gray-900 text-sm">Fluxo de Caixa Diário</h3>
          <div className="flex items-center gap-2">
            <select value={flowMonth} onChange={(e) => { const m = Number(e.target.value); setFlowMonth(m); loadFlow(flowYear, m) }} className="h-8 rounded-md border border-input bg-white px-2 py-0.5 text-xs shadow-sm focus:outline-none">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={flowYear} onChange={(e) => { const y = Number(e.target.value); setFlowYear(y); loadFlow(y, flowMonth) }} className="h-8 rounded-md border border-input bg-white px-2 py-0.5 text-xs shadow-sm focus:outline-none">
              {[flowYear - 1, flowYear, flowYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {loadingFlow && <span className="text-xs text-gray-400">...</span>}
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />Entradas</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Saídas</span>
        </div>

        <div className="flex items-end gap-0.5 h-40 overflow-x-auto pb-2">
          {flow.dailyFlow.map((d) => {
            const entH = maxFlow > 0 ? (d.entradas / maxFlow) * 100 : 0
            const saidH = maxFlow > 0 ? (d.saidas / maxFlow) * 100 : 0
            const hasData = d.entradas > 0 || d.saidas > 0
            return (
              <div key={d.day} className="flex flex-col items-center gap-0.5 min-w-[14px] flex-1 group relative">
                {hasData && (
                  <div className="absolute bottom-full mb-1 z-10 hidden group-hover:block bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap pointer-events-none">
                    Dia {d.day}<br />↑ {formatCurrency(d.entradas)}<br />↓ {formatCurrency(d.saidas)}
                  </div>
                )}
                <div className="flex items-end gap-0.5 h-32 w-full">
                  <div className="flex-1 bg-green-400 rounded-t-sm transition-all" style={{ height: `${entH}%`, minHeight: d.entradas > 0 ? "2px" : "0" }} />
                  <div className="flex-1 bg-red-400 rounded-t-sm transition-all" style={{ height: `${saidH}%`, minHeight: d.saidas > 0 ? "2px" : "0" }} />
                </div>
                {d.day % 5 === 0 || d.day === 1 ? <span className="text-[9px] text-gray-400">{d.day}</span> : <span className="text-[9px] text-transparent">·</span>}
              </div>
            )
          })}
        </div>
      </div>

      <FormSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Nova Conta Bancária" />
      <FormSheet open={!!editAccount} onClose={() => setEditAccount(null)} title="Editar Conta Bancária" />

      <AlertDialog open={!!deleteAccount} onOpenChange={(o) => !o && setDeleteAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Arquivar conta?</AlertDialogTitle><AlertDialogDescription>"{deleteAccount?.name}" será arquivada e não aparecerá mais na tesouraria.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Arquivar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
