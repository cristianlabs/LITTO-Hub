"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatCurrency, timeAgo } from "@/lib/utils"
import {
  Plus,
  Search,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Stamp,
  Trash2,
  ChevronDown,
  Eye,
} from "lucide-react"

type FiscalNoteType = "ENTRADA" | "SAIDA"
type FiscalNoteStatus = "PENDING" | "RECEIVED" | "CANCELLED"

interface Canhoto {
  id: string
  receivedBy: string
  receivedAt: string
  observations: string | null
  confirmed: boolean
  createdAt: string
}

interface PurchaseOrderRef {
  id: string
  number: string
  title: string
}

interface FiscalNote {
  id: string
  number: string
  series: string
  type: FiscalNoteType
  status: FiscalNoteStatus
  accessKey: string | null
  emitter: string
  recipient: string | null
  totalValue: number
  emittedAt: string
  notes: string | null
  purchaseOrder: PurchaseOrderRef | null
  canhoto: Canhoto | null
  createdAt: string
}

interface Props {
  initialNotes: FiscalNote[]
  purchaseOrders: PurchaseOrderRef[]
}

const STATUS_LABELS: Record<FiscalNoteStatus, string> = {
  PENDING: "Pendente",
  RECEIVED: "Recebida",
  CANCELLED: "Cancelada",
}

const STATUS_COLORS: Record<FiscalNoteStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  RECEIVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
}

const TYPE_LABELS: Record<FiscalNoteType, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
}

const noteSchema = z.object({
  number: z.string().min(1, "Obrigatório"),
  series: z.string().default("1"),
  type: z.enum(["ENTRADA", "SAIDA"]),
  accessKey: z.string().optional(),
  emitter: z.string().min(1, "Obrigatório"),
  recipient: z.string().optional(),
  totalValue: z.coerce.number().min(0),
  emittedAt: z.string().min(1, "Obrigatório"),
  notes: z.string().optional(),
  purchaseOrderId: z.string().optional(),
})

const canhotoSchema = z.object({
  receivedBy: z.string().min(1, "Obrigatório"),
  receivedAt: z.string().min(1, "Obrigatório"),
  observations: z.string().optional(),
})

type NoteFormData = z.infer<typeof noteSchema>
type CanhotoFormData = z.infer<typeof canhotoSchema>

export function NfeClient({ initialNotes, purchaseOrders }: Props) {
  const [notes, setNotes] = useState(initialNotes)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<FiscalNoteStatus | "ALL">("ALL")
  const [filterType, setFilterType] = useState<FiscalNoteType | "ALL">("ALL")
  const [createOpen, setCreateOpen] = useState(false)
  const [viewNote, setViewNote] = useState<FiscalNote | null>(null)
  const [canhotoOpen, setCanhotoOpen] = useState(false)
  const [deleteNote, setDeleteNote] = useState<FiscalNote | null>(null)
  const [statusOpen, setStatusOpen] = useState<string | null>(null)

  const noteForm = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema) as never,
    defaultValues: { series: "1", type: "ENTRADA", totalValue: 0 },
  })

  const canhotoForm = useForm<CanhotoFormData>({
    resolver: zodResolver(canhotoSchema) as never,
    defaultValues: { receivedAt: new Date().toISOString().slice(0, 16) },
  })

  async function onCreateNote(data: NoteFormData) {
    const res = await fetch("/api/nfe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const note = await res.json()
      setNotes((prev) => [note, ...prev])
      setCreateOpen(false)
      noteForm.reset({ series: "1", type: "ENTRADA", totalValue: 0 })
    } else {
      alert("Erro ao registrar NF")
    }
  }

  async function onRegisterCanhoto(data: CanhotoFormData) {
    if (!viewNote) return
    const res = await fetch(`/api/nfe/${viewNote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      setViewNote(updated)
      setCanhotoOpen(false)
      canhotoForm.reset({ receivedAt: new Date().toISOString().slice(0, 16) })
    } else {
      alert("Erro ao registrar canhoto")
    }
  }

  async function updateStatus(id: string, status: FiscalNoteStatus) {
    const res = await fetch(`/api/nfe/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
      if (viewNote?.id === id) setViewNote(updated)
    }
    setStatusOpen(null)
  }

  async function confirmDelete() {
    if (!deleteNote) return
    await fetch(`/api/nfe/${deleteNote.id}`, { method: "DELETE" })
    setNotes((prev) => prev.filter((n) => n.id !== deleteNote.id))
    setDeleteNote(null)
    if (viewNote?.id === deleteNote.id) setViewNote(null)
  }

  const filtered = notes.filter((n) => {
    if (filterStatus !== "ALL" && n.status !== filterStatus) return false
    if (filterType !== "ALL" && n.type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        n.number.toLowerCase().includes(q) ||
        n.emitter.toLowerCase().includes(q) ||
        (n.recipient?.toLowerCase().includes(q) ?? false) ||
        (n.accessKey?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  const totalEntrada = notes.filter((n) => n.type === "ENTRADA" && n.status !== "CANCELLED").reduce((s, n) => s + n.totalValue, 0)
  const totalSaida = notes.filter((n) => n.type === "SAIDA" && n.status !== "CANCELLED").reduce((s, n) => s + n.totalValue, 0)
  const pending = notes.filter((n) => n.status === "PENDING").length
  const withCanhoto = notes.filter((n) => n.canhoto !== null).length

  const kpis = [
    { label: "Total NFs", value: notes.length, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Aguardando", value: pending, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Com Canhoto", value: withCanhoto, icon: Stamp, color: "text-green-600", bg: "bg-green-50" },
    { label: "Entradas", value: formatCurrency(totalEntrada), icon: ArrowDownCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
  ]

  return (
    <div className="p-6 space-y-6">
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              className="pl-8 h-9 w-52 text-sm"
              placeholder="Buscar NF, emitente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as never)}
            className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="RECEIVED">Recebida</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as never)}
            className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">Entrada e Saída</option>
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
          </select>
        </div>
        <Button
          size="sm"
          onClick={() => {
            noteForm.reset({ series: "1", type: "ENTRADA", totalValue: 0 })
            setCreateOpen(true)
          }}
        >
          <Plus className="w-4 h-4 mr-1.5" /> Nova NF
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">NF / Série</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Emitente</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Valor</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Emissão</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Canhoto</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-14 text-gray-400">
                  Nenhuma nota fiscal encontrada
                </td>
              </tr>
            ) : (
              filtered.map((n) => (
                <tr key={n.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <button onClick={() => setViewNote(n)} className="text-left hover:underline">
                      <p className="font-medium text-gray-900 font-mono">
                        {n.number}-{n.series}
                      </p>
                      {n.accessKey && (
                        <p className="text-xs text-gray-400 truncate max-w-[160px]" title={n.accessKey}>
                          {n.accessKey.slice(0, 20)}…
                        </p>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        n.type === "ENTRADA"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-orange-50 text-orange-700"
                      }`}
                    >
                      {n.type === "ENTRADA" ? (
                        <ArrowDownCircle className="w-3 h-3" />
                      ) : (
                        <ArrowUpCircle className="w-3 h-3" />
                      )}
                      {TYPE_LABELS[n.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{n.emitter}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(n.totalValue)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(n.emittedAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() => setStatusOpen(statusOpen === n.id ? null : n.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[n.status]}`}
                      >
                        {STATUS_LABELS[n.status]} <ChevronDown className="w-3 h-3" />
                      </button>
                      {statusOpen === n.id && (
                        <div className="absolute z-10 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[150px]">
                          {(["PENDING", "RECEIVED", "CANCELLED"] as FiscalNoteStatus[]).map((s) => (
                            <button
                              key={s}
                              onClick={() => updateStatus(n.id, s)}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${n.status === s ? "font-semibold" : ""}`}
                            >
                              {STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {n.canhoto ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Confirmado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" /> Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => { setViewNote(n) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteNote(n)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View note sheet */}
      <Sheet open={!!viewNote} onOpenChange={(o) => !o && setViewNote(null)}>
        <SheetContent className="sm:max-w-lg">
          {viewNote && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="font-mono">
                      NF {viewNote.number}-{viewNote.series}
                    </SheetTitle>
                    <p className="text-xs text-gray-400 mt-0.5">{TYPE_LABELS[viewNote.type]}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[viewNote.status]}`}>
                    {STATUS_LABELS[viewNote.status]}
                  </span>
                </div>
              </SheetHeader>
              <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Emitente</p>
                    <p className="font-medium text-sm mt-0.5">{viewNote.emitter}</p>
                  </div>
                  {viewNote.recipient && (
                    <div>
                      <p className="text-xs text-gray-500">Destinatário</p>
                      <p className="font-medium text-sm mt-0.5">{viewNote.recipient}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Valor Total</p>
                    <p className="font-bold text-lg text-gray-900 mt-0.5">{formatCurrency(viewNote.totalValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Data de Emissão</p>
                    <p className="font-medium text-sm mt-0.5">
                      {new Date(viewNote.emittedAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>

                {viewNote.accessKey && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Chave de Acesso</p>
                    <p className="font-mono text-xs bg-gray-50 border border-gray-100 rounded-lg p-2 break-all">
                      {viewNote.accessKey}
                    </p>
                  </div>
                )}

                {viewNote.purchaseOrder && (
                  <div>
                    <p className="text-xs text-gray-500">Pedido de Compra Vinculado</p>
                    <p className="font-medium text-sm mt-0.5">
                      {viewNote.purchaseOrder.number} — {viewNote.purchaseOrder.title}
                    </p>
                  </div>
                )}

                {viewNote.notes && (
                  <div>
                    <p className="text-xs text-gray-500">Observações</p>
                    <p className="text-sm text-gray-700 mt-0.5">{viewNote.notes}</p>
                  </div>
                )}

                {/* Canhoto section */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Stamp className="w-4 h-4 text-gray-500" />
                      <p className="text-sm font-semibold text-gray-800">Canhoto de Entrega</p>
                    </div>
                    {!viewNote.canhoto && viewNote.status !== "CANCELLED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          canhotoForm.reset({ receivedAt: new Date().toISOString().slice(0, 16) })
                          setCanhotoOpen(true)
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Registrar
                      </Button>
                    )}
                  </div>
                  {viewNote.canhoto ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-green-700">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Entrega confirmada</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Recebido por</p>
                          <p className="font-medium">{viewNote.canhoto.receivedBy}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Data de recebimento</p>
                          <p className="font-medium">
                            {new Date(viewNote.canhoto.receivedAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      {viewNote.canhoto.observations && (
                        <div>
                          <p className="text-xs text-gray-500">Obs.</p>
                          <p className="text-sm text-gray-700">{viewNote.canhoto.observations}</p>
                        </div>
                      )}
                      <p className="text-xs text-gray-400">
                        Registrado {timeAgo(viewNote.canhoto.createdAt)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Clock className="w-4 h-4" />
                      Aguardando confirmação de entrega
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Canhoto form sheet */}
      <Sheet open={canhotoOpen} onOpenChange={(o) => !o && setCanhotoOpen(false)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="mb-6">
            <SheetTitle>Registrar Canhoto</SheetTitle>
            <p className="text-sm text-gray-500">
              NF {viewNote?.number}-{viewNote?.series}
            </p>
          </SheetHeader>
          <form onSubmit={canhotoForm.handleSubmit(onRegisterCanhoto)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Recebido por *</Label>
              <Input
                {...canhotoForm.register("receivedBy")}
                placeholder="Nome de quem recebeu a mercadoria"
              />
              {canhotoForm.formState.errors.receivedBy && (
                <p className="text-red-500 text-xs">{canhotoForm.formState.errors.receivedBy.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Data e hora de recebimento *</Label>
              <Input
                {...canhotoForm.register("receivedAt")}
                type="datetime-local"
              />
              {canhotoForm.formState.errors.receivedAt && (
                <p className="text-red-500 text-xs">{canhotoForm.formState.errors.receivedAt.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <textarea
                {...canhotoForm.register("observations")}
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Condições da entrega, divergências, etc."
              />
            </div>
            <SheetFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCanhotoOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={canhotoForm.formState.isSubmitting}>
                {canhotoForm.formState.isSubmitting ? "Salvando..." : "Confirmar entrega"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Create NF sheet */}
      <Sheet open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader className="mb-6">
            <SheetTitle>Registrar Nota Fiscal</SheetTitle>
          </SheetHeader>
          <form
            onSubmit={noteForm.handleSubmit(onCreateNote)}
            className="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] pr-1"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Número *</Label>
                <Input {...noteForm.register("number")} placeholder="000001" />
                {noteForm.formState.errors.number && (
                  <p className="text-red-500 text-xs">{noteForm.formState.errors.number.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Série</Label>
                <Input {...noteForm.register("series")} placeholder="1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <select
                  {...noteForm.register("type")}
                  className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA">Saída</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Data de Emissão *</Label>
                <Input {...noteForm.register("emittedAt")} type="date" />
                {noteForm.formState.errors.emittedAt && (
                  <p className="text-red-500 text-xs">{noteForm.formState.errors.emittedAt.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Emitente *</Label>
              <Input {...noteForm.register("emitter")} placeholder="Razão social ou nome do emitente" />
              {noteForm.formState.errors.emitter && (
                <p className="text-red-500 text-xs">{noteForm.formState.errors.emitter.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Destinatário</Label>
              <Input {...noteForm.register("recipient")} placeholder="Razão social ou nome do destinatário" />
            </div>

            <div className="space-y-1.5">
              <Label>Valor Total *</Label>
              <Input
                {...noteForm.register("totalValue")}
                type="number"
                min={0}
                step="0.01"
                placeholder="0,00"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Chave de Acesso (44 dígitos)</Label>
              <Input
                {...noteForm.register("accessKey")}
                placeholder="00000000000000000000000000000000000000000000"
                maxLength={44}
              />
            </div>

            {purchaseOrders.length > 0 && (
              <div className="space-y-1.5">
                <Label>Vincular a Pedido de Compra</Label>
                <select
                  {...noteForm.register("purchaseOrderId")}
                  className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Nenhum —</option>
                  {purchaseOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.number} — {o.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <textarea
                {...noteForm.register("notes")}
                rows={2}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Informações adicionais..."
              />
            </div>

            <SheetFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={noteForm.formState.isSubmitting}>
                {noteForm.formState.isSubmitting ? "Registrando..." : "Registrar NF"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteNote} onOpenChange={(o) => !o && setDeleteNote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              NF {deleteNote?.number}-{deleteNote?.series} de {deleteNote?.emitter} será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {statusOpen && <div className="fixed inset-0 z-0" onClick={() => setStatusOpen(null)} />}
    </div>
  )
}
