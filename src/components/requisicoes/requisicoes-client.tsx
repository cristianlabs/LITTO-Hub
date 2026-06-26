"use client"

import React, { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, ThumbsUp, MessageSquare, X, Send, Trash2, ShoppingCart, Cpu, Building2, AlertTriangle, CheckCircle2, ChevronDown, XCircle } from "lucide-react"
import { timeAgo, getInitials } from "@/lib/utils"
import type { RequisitionCategory, RequisitionStatus, Priority } from "@prisma/client"

const CATEGORY_LABELS: Record<RequisitionCategory, string> = {
  PURCHASE: "Compras",
  SYSTEM_IMPROVEMENT: "Melhoria de Sistema",
  INFRASTRUCTURE: "Infraestrutura",
}
const CATEGORY_ICONS: Record<RequisitionCategory, React.ElementType> = {
  PURCHASE: ShoppingCart,
  SYSTEM_IMPROVEMENT: Cpu,
  INFRASTRUCTURE: Building2,
}
const STATUS_LABELS: Record<RequisitionStatus, string> = {
  DRAFT: "Rascunho", OPEN: "Aberto", IN_REVIEW: "Em revisão",
  APPROVED: "Aprovado", REJECTED: "Rejeitado", DONE: "Concluído",
}
const STATUS_COLORS: Record<RequisitionStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  OPEN: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  DONE: "bg-purple-100 text-purple-700",
}
const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica",
}
const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: "text-gray-500", MEDIUM: "text-blue-500", HIGH: "text-orange-500", CRITICAL: "text-red-600 font-semibold",
}
// Active statuses shown in main table
const ACTIVE_STATUSES: RequisitionStatus[] = ["DRAFT", "OPEN", "IN_REVIEW", "APPROVED"]
// Status cycle order (for click-to-advance, manager only)
const STATUS_CYCLE: RequisitionStatus[] = ["DRAFT", "OPEN", "IN_REVIEW", "APPROVED", "REJECTED", "DONE"]
const CATEGORIES: RequisitionCategory[] = ["PURCHASE", "SYSTEM_IMPROVEMENT", "INFRASTRUCTURE"]
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

interface Comment {
  id: string
  content: string
  createdAt: string
  user: { id: string; name: string | null }
}

interface CustomStatus {
  id: string
  name: string
  color: string
}

interface Requisition {
  id: string
  title: string
  description?: string | null
  category: RequisitionCategory
  status: RequisitionStatus
  priority: Priority
  votes: number
  createdAt: string
  customStatusId?: string | null
  customStatus?: CustomStatus | null
  user: { id: string; name: string | null }
  _count: { comments: number }
}

interface RequisitionDetail extends Requisition {
  comments: Comment[]
}

interface Props {
  initialRequisitions: Requisition[]
  isManager: boolean
  currentUserId: string
  customStatuses: CustomStatus[]
}

function StatusBadge({ r }: { r: Pick<Requisition, "status" | "customStatus"> }) {
  if (r.customStatus) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
        style={{ backgroundColor: r.customStatus.color }}
      >
        {r.customStatus.name}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
      {STATUS_LABELS[r.status]}
    </span>
  )
}

// Inline status picker shown on click (dropdown-style popover)
function StatusPicker({
  status,
  customStatus,
  customStatuses,
  onChange,
}: {
  status: RequisitionStatus
  customStatus?: CustomStatus | null
  customStatuses: CustomStatus[]
  onChange: (payload: { status?: RequisitionStatus; customStatusId?: string | null }) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
      >
        <StatusBadge r={{ status, customStatus }} />
        <ChevronDown className="w-3 h-3 opacity-60 text-gray-400" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 pt-1 pb-0.5 text-[10px] text-gray-400 uppercase tracking-wide">Padrão</p>
          {STATUS_CYCLE.map((s) => (
            <button
              key={s}
              onClick={() => { onChange({ status: s, customStatusId: null }); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${!customStatus && s === status ? "font-semibold" : ""}`}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[s].split(" ")[0]}`} />
              {STATUS_LABELS[s]}
            </button>
          ))}
          {customStatuses.length > 0 && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <p className="px-3 pb-0.5 text-[10px] text-gray-400 uppercase tracking-wide">Personalizados</p>
              {customStatuses.map((cs) => (
                <button
                  key={cs.id}
                  onClick={() => { onChange({ customStatusId: cs.id }); setOpen(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${customStatus?.id === cs.id ? "font-semibold" : ""}`}
                >
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: cs.color }} />
                  {cs.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function RequisicoesClient({ initialRequisitions, isManager, currentUserId, customStatuses }: Props) {
  const [items, setItems] = useState(initialRequisitions)
  const [tab, setTab] = useState<"ativas" | "rejeitadas" | "concluidas">("ativas")
  const [filterStatus, setFilterStatus] = useState<RequisitionStatus | "ALL">("ALL")
  const [filterCat, setFilterCat] = useState<RequisitionCategory | "ALL">("ALL")
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<RequisitionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [form, setForm] = useState({ title: "", description: "", category: "PURCHASE" as RequisitionCategory, priority: "MEDIUM" as Priority })
  const [creating, setCreating] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [commenting, setCommenting] = useState(false)

  const active = items.filter((r) => r.status !== "DONE" && r.status !== "REJECTED")
  const rejected = items.filter((r) => r.status === "REJECTED")
  const done = items.filter((r) => r.status === "DONE")

  const tabItems = tab === "ativas" ? active : tab === "rejeitadas" ? rejected : done
  const filtered = tabItems.filter((r) => {
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false
    if (filterCat !== "ALL" && r.category !== filterCat) return false
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function createRequisition() {
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/requisicoes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const created = await res.json()
        setItems((prev) => [created, ...prev])
        setShowCreate(false)
        setForm({ title: "", description: "", category: "PURCHASE", priority: "MEDIUM" })
      }
    } finally { setCreating(false) }
  }

  async function openDetail(id: string) {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/requisicoes/${id}`)
      if (res.ok) setDetail(await res.json())
    } finally { setDetailLoading(false) }
  }

  async function vote(id: string) {
    const res = await fetch(`/api/requisicoes/${id}/votar`, { method: "POST" })
    if (res.ok) {
      const { votes } = await res.json()
      setItems((prev) => prev.map((r) => r.id === id ? { ...r, votes } : r))
      if (detail?.id === id) setDetail((d) => d ? { ...d, votes } : d)
    }
  }

  async function changeStatus(id: string, payload: { status?: RequisitionStatus; customStatusId?: string | null }) {
    const res = await fetch(`/api/requisicoes/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated = await res.json()
      setItems((prev) => prev.map((r) => r.id === id ? { ...r, ...updated } : r))
      if (detail?.id === id) setDetail((d) => d ? { ...d, ...updated } : d)
      if (payload.status === "DONE") setTab("concluidas")
      else if (payload.status === "REJECTED") setTab("rejeitadas")
    }
  }

  async function addComment() {
    if (!commentText.trim() || !detail) return
    setCommenting(true)
    try {
      const res = await fetch(`/api/requisicoes/${detail.id}/comentarios`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      })
      if (res.ok) {
        const comment = await res.json()
        setDetail((d) => d ? { ...d, comments: [...d.comments, comment], _count: { comments: d._count.comments + 1 } } : d)
        setItems((prev) => prev.map((r) => r.id === detail.id ? { ...r, _count: { comments: r._count.comments + 1 } } : r))
        setCommentText("")
      }
    } finally { setCommenting(false) }
  }

  async function deleteRequisition(id: string) {
    if (!confirm("Excluir esta requisição?")) return
    const res = await fetch(`/api/requisicoes/${id}`, { method: "DELETE" })
    if (res.ok) {
      setItems((prev) => prev.filter((r) => r.id !== id))
      if (detail?.id === id) setDetail(null)
    }
  }

  const countByStatus = (s: RequisitionStatus) => items.filter((r) => r.status === s).length

  return (
    <div className="p-6 space-y-6">
      {/* Stats row — active statuses only */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ACTIVE_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setTab("ativas"); setFilterStatus(filterStatus === s ? "ALL" : s) }}
            className={`rounded-xl p-3 text-left border transition-all ${filterStatus === s && tab === "ativas" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
          >
            <p className="text-xs text-gray-500">{STATUS_LABELS[s]}</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{countByStatus(s)}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => { setTab("ativas"); setFilterStatus("ALL") }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === "ativas" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Ativas
          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">{active.length}</span>
        </button>
        <button
          onClick={() => { setTab("rejeitadas"); setFilterStatus("ALL") }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${tab === "rejeitadas" ? "border-red-500 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <XCircle className="w-3.5 h-3.5" />
          Rejeitadas
          {rejected.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-xs">{rejected.length}</span>
          )}
        </button>
        <button
          onClick={() => { setTab("concluidas"); setFilterStatus("ALL") }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${tab === "concluidas" ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Concluídas
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">{done.length}</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar requisição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 text-sm w-60"
        />
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value as RequisitionCategory | "ALL")}
          className="h-9 rounded-md border border-input bg-white px-3 text-sm"
        >
          <option value="ALL">Todas as categorias</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        {tab === "ativas" && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as RequisitionStatus | "ALL")}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="ALL">Todos os status</option>
            {ACTIVE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        )}
        {tab === "rejeitadas" && (
          <span className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-md px-3 h-9 flex items-center">
            Exibindo apenas requisições rejeitadas
          </span>
        )}
        <div className="flex-1" />
        <Button size="sm" onClick={() => setShowCreate(true)} className="h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nova requisição
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Título</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium hidden sm:table-cell">Categoria</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium hidden md:table-cell">Prioridade</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium hidden md:table-cell">Autor</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Votos</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium hidden sm:table-cell">Comentários</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  {tab === "concluidas" ? "Nenhuma requisição concluída ainda" : tab === "rejeitadas" ? "Nenhuma requisição rejeitada" : "Nenhuma requisição encontrada"}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const Icon = CATEGORY_ICONS[r.category]
                return (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r.id)}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer ${tab === "concluidas" || tab === "rejeitadas" ? "opacity-75" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <p className={`font-medium text-gray-900 ${tab === "concluidas" ? "line-through decoration-gray-300" : tab === "rejeitadas" ? "line-through decoration-red-200" : ""}`}>{r.title}</p>
                      {r.description && <p className="text-xs text-gray-400 truncate max-w-xs">{r.description}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(r.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Icon className="w-3.5 h-3.5 text-gray-400" />
                        {CATEGORY_LABELS[r.category]}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {isManager ? (
                        <StatusPicker
                          status={r.status}
                          customStatus={r.customStatus}
                          customStatuses={customStatuses}
                          onChange={(payload) => changeStatus(r.id, payload)}
                        />
                      ) : (
                        <StatusBadge r={r} />
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs ${PRIORITY_COLORS[r.priority]}`}>{PRIORITY_LABELS[r.priority]}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{r.user.name ?? "—"}</td>
                    <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); vote(r.id) }}>
                      <button className="flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">{r.votes}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1 text-gray-400">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="text-xs">{r._count.comments}</span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Nova Requisição</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Descreva brevemente a requisição" />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Detalhes adicionais..." rows={3} className="resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as RequisitionCategory }))} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridade</Label>
                  <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button size="sm" onClick={createRequisition} disabled={creating || !form.title.trim()}>
                {creating ? "Criando..." : "Criar requisição"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={() => setDetail(null)}>
          <div className="bg-white h-full w-full max-w-xl shadow-2xl overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">Carregando...</div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {isManager ? (
                        <StatusPicker
                          status={detail.status}
                          customStatus={detail.customStatus}
                          customStatuses={customStatuses}
                          onChange={(payload) => changeStatus(detail.id, payload)}
                        />
                      ) : (
                        <StatusBadge r={detail} />
                      )}
                      <span className={`text-xs ${PRIORITY_COLORS[detail.priority]}`}>
                        {detail.priority === "CRITICAL" && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                        {PRIORITY_LABELS[detail.priority]}
                      </span>
                    </div>
                    <h2 className="font-semibold text-gray-900 text-base">{detail.title}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {detail.user.name} · {timeAgo(detail.createdAt)} · {CATEGORY_LABELS[detail.category]}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(detail.user.id === currentUserId || isManager) && (
                      <button onClick={() => deleteRequisition(detail.id)} className="p-1.5 text-gray-300 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => setDetail(null)} className="p-1.5 text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 px-5 py-4 space-y-5">
                  {detail.description && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.description}</p>
                  )}

                  <button
                    onClick={() => vote(detail.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> {detail.votes} votos
                  </button>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900">Comentários ({detail.comments.length})</h3>
                    {detail.comments.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Nenhum comentário ainda.</p>
                    )}
                    {detail.comments.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                          {getInitials(c.user.name ?? "?")}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-gray-900">{c.user.name ?? "Usuário"}</span>
                            <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
                  <div className="flex gap-2">
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Adicionar comentário..."
                      rows={2}
                      className="resize-none text-sm flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment() } }}
                    />
                    <Button size="sm" onClick={addComment} disabled={!commentText.trim() || commenting} className="self-end h-9 w-9 p-0">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
