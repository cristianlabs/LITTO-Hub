"use client"

import { useState, useTransition, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Search, TrendingUp, TrendingDown, ExternalLink,
  CheckCircle2, XCircle, Circle, ChevronDown, Plus, Trash2, Package,
} from "lucide-react"

interface Seller { id: string; name: string | null }
interface Pipeline { id: string; name: string; color: string }
interface Contact { id: string; name: string; phone?: string | null; whatsapp?: string | null }
interface Product { id: string; name: string; sku: string; salePrice: number; currentStock: number; unit: string }

interface DealItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  product: { id: string; name: string; sku: string; unit: string }
}

interface Deal {
  id: string
  title: string
  value: number | null
  status: "OPEN" | "WON" | "LOST"
  createdAt: string
  closedAt: string | null
  expectedClose: string | null
  contact: { id: string; name: string } | null
  pipeline: { id: string; name: string; color: string }
  seller: Seller | null
  items: DealItem[]
}

interface Props {
  initialDeals: Deal[]
  sellers: Seller[]
  pipelines: Pipeline[]
  contacts: Contact[]
  products: Product[]
}

const STATUS_CONFIG = {
  OPEN:  { label: "Em aberto",  icon: Circle,       color: "text-blue-600",  bg: "bg-blue-50"  },
  WON:   { label: "Ganho",      icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  LOST:  { label: "Perdido",    icon: XCircle,      color: "text-red-600",   bg: "bg-red-50"   },
}

// ─── Nova Venda Modal ─────────────────────────────────────────────────────────

interface ModalItem { productId: string; quantity: number; unitPrice: number }

function NovaVendaModal({
  pipelines, contacts, products, sellers, onClose, onCreated,
}: {
  pipelines: Pipeline[]
  contacts: Contact[]
  products: Product[]
  sellers: Seller[]
  onClose: () => void
  onCreated: (deal: Deal) => void
}) {
  const [title, setTitle] = useState("")
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "")
  const [contactId, setContactId] = useState("")
  const [sellerId, setSellerId] = useState("")
  const [expectedClose, setExpectedClose] = useState("")
  const [items, setItems] = useState<ModalItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Contact search
  const [contactSearch, setContactSearch] = useState("")
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const contactSearchRef = useRef<HTMLDivElement>(null)

  const filteredContacts = contactSearch
    ? contacts.filter((c) => c.name.toLowerCase().includes(contactSearch.toLowerCase()))
    : contacts.slice(0, 8)

  const selectedContact = contacts.find((c) => c.id === contactId)

  function addItem() {
    const first = products[0]
    if (!first) return
    setItems((prev) => [...prev, { productId: first.id, quantity: 1, unitPrice: first.salePrice }])
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ModalItem, val: string | number) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: val }
      // Auto-fill price when product changes
      if (field === "productId") {
        const p = products.find((p) => p.id === val)
        if (p) updated.unitPrice = p.salePrice
      }
      return updated
    }))
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError("Título obrigatório"); return }
    if (!pipelineId) { setError("Selecione uma etapa do pipeline"); return }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          pipelineId,
          contactId: contactId || undefined,
          sellerId: sellerId || undefined,
          expectedClose: expectedClose || undefined,
          items: items.length > 0 ? items : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ? JSON.stringify(data.error) : "Erro ao criar venda"); return }
      onCreated(data)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-lg">Nova Venda</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Título da venda *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Contrato Anual, Pedido #123..." />
          </div>

          {/* Pipeline + Previsão */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Etapa do pipeline *</label>
              <select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Previsão de fechamento</label>
              <Input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} />
            </div>
          </div>

          {/* Cliente */}
          <div className="space-y-1.5" ref={contactSearchRef}>
            <label className="text-sm font-medium text-gray-700">Cliente</label>
            {selectedContact ? (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-sm text-blue-800 flex-1">{selectedContact.name}</span>
                <button type="button" onClick={() => { setContactId(""); setContactSearch("") }}
                  className="text-blue-400 hover:text-blue-600 text-xs">✕</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  className="pl-8"
                  placeholder="Buscar cliente..."
                  value={contactSearch}
                  onChange={(e) => { setContactSearch(e.target.value); setShowContactDropdown(true) }}
                  onFocus={() => setShowContactDropdown(true)}
                />
                {showContactDropdown && filteredContacts.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredContacts.map((c) => (
                      <button key={c.id} type="button"
                        onClick={() => { setContactId(c.id); setContactSearch(""); setShowContactDropdown(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.phone || c.whatsapp || ""}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vendedor */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Vendedor responsável</label>
            <select value={sellerId} onChange={(e) => setSellerId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">— sem vendedor</option>
              {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Itens do estoque */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Produtos / Itens</label>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                <Plus className="w-3.5 h-3.5" /> Adicionar item
              </button>
            </div>

            {items.length === 0 ? (
              <button type="button" onClick={addItem}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 text-center text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                <Package className="w-5 h-5 mx-auto mb-1.5" />
                Clique para vincular produtos do estoque
              </button>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const prod = products.find((p) => p.id === item.productId)
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(idx, "productId", e.target.value)}
                        className="flex-1 h-8 rounded-md border border-input bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — Estoque: {p.currentStock} {p.unit}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number" min={1} max={prod?.currentStock ?? 9999}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-xs text-center"
                      />
                      <span className="text-xs text-gray-400">{prod?.unit ?? "un"}</span>
                      <Input
                        type="number" min={0} step={0.01}
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="w-24 h-8 text-xs"
                        placeholder="Preço"
                      />
                      <button type="button" onClick={() => removeItem(idx)}
                        className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
                <div className="flex justify-end">
                  <p className="text-sm font-semibold text-gray-900 bg-gray-100 rounded-lg px-3 py-1.5">
                    Total: {formatCurrency(total)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Criando..." : "Criar venda"}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VendasClient({ initialDeals, sellers, pipelines, contacts, products }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [deals, setDeals] = useState(initialDeals)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [sellerFilter, setSellerFilter] = useState("")
  const [updating, setUpdating] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router])

  async function changeStatus(id: string, status: "OPEN" | "WON" | "LOST") {
    setUpdating(id)
    const res = await fetch("/api/vendas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setDeals((prev) => prev.map((d) => d.id === id ? { ...d, ...updated } : d))
      if (status === "WON") refresh() // refresh to update stock counts
    }
    setUpdating(null)
  }

  async function assignSeller(id: string, sellerId: string) {
    await fetch("/api/vendas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, sellerId: sellerId || null }),
    })
    setDeals((prev) => prev.map((d) => {
      if (d.id !== id) return d
      const seller = sellers.find((s) => s.id === sellerId) ?? null
      return { ...d, seller }
    }))
  }

  const filtered = deals.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false
    if (sellerFilter && d.seller?.id !== sellerFilter) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) &&
        !d.contact?.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const wonValue = filtered.filter((d) => d.status === "WON").reduce((s, d) => s + (d.value ?? 0), 0)
  const openValue = filtered.filter((d) => d.status === "OPEN").reduce((s, d) => s + (d.value ?? 0), 0)
  const wonCount = filtered.filter((d) => d.status === "WON").length
  const total = filtered.length
  const conversion = total > 0 ? Math.round((wonCount / total) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      {showModal && (
        <NovaVendaModal
          pipelines={pipelines}
          contacts={contacts}
          products={products}
          sellers={sellers}
          onClose={() => setShowModal(false)}
          onCreated={(deal) => {
            setDeals((prev) => [deal, ...prev])
            setShowModal(false)
          }}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Receita gerada", value: formatCurrency(wonValue), sub: `${wonCount} negócio(s) ganho(s)`, color: "text-green-600", bg: "bg-green-50", icon: TrendingUp },
          { label: "Em pipeline", value: formatCurrency(openValue), sub: `${filtered.filter(d => d.status === "OPEN").length} em aberto`, color: "text-blue-600", bg: "bg-blue-50", icon: Circle },
          { label: "Conversão", value: `${conversion}%`, sub: `${wonCount} de ${total} negócios`, color: "text-purple-600", bg: "bg-purple-50", icon: CheckCircle2 },
          { label: "Perdidos", value: filtered.filter(d => d.status === "LOST").length.toString(), sub: formatCurrency(filtered.filter(d => d.status === "LOST").reduce((s, d) => s + (d.value ?? 0), 0)), color: "text-red-600", bg: "bg-red-50", icon: TrendingDown },
        ].map(({ label, value, sub, color, bg, icon: Icon }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Nova Venda */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input className="pl-8 h-9 w-56 text-sm" placeholder="Buscar negócio ou cliente..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="flex gap-1">
          {[
            { key: "", label: "Todos" },
            { key: "OPEN", label: "Em aberto" },
            { key: "WON", label: "Ganhos" },
            { key: "LOST", label: "Perdidos" },
          ].map((f) => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === f.key ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {f.label}
            </button>
          ))}
        </div>

        <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">Todos os vendedores</option>
          {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => setShowModal(true)} className="h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Nova venda
          </Button>
          <Link href="/crm/pipeline" className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
            <ExternalLink className="w-4 h-4" /> Ver Kanban
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Negócio</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Produtos</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Pipeline</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Vendedor</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Valor</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Data</th>
              <th className="w-8 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-14">
                  <div className="text-gray-300 mb-2">
                    <Circle className="w-10 h-10 mx-auto" />
                  </div>
                  <p className="text-gray-400 font-medium">Nenhum negócio encontrado</p>
                  <button onClick={() => setShowModal(true)} className="mt-3 text-sm text-blue-600 hover:underline">
                    + Criar nova venda
                  </button>
                </td>
              </tr>
            ) : filtered.map((deal) => {
              const cfg = STATUS_CONFIG[deal.status]
              const Icon = cfg.icon
              return (
                <tr key={deal.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{deal.title}</p>
                    {deal.contact && (
                      <Link href={`/crm/${deal.contact.id}`} className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1">
                        {deal.contact.name} <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {deal.items.length > 0 ? (
                      <div className="space-y-0.5">
                        {deal.items.slice(0, 2).map((item) => (
                          <p key={item.id} className="text-xs text-gray-500">
                            {item.quantity}× {item.product.name}
                          </p>
                        ))}
                        {deal.items.length > 2 && (
                          <p className="text-xs text-gray-400">+{deal.items.length - 2} item(s)</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: deal.pipeline.color }} />
                      <span className="text-xs text-gray-600">{deal.pipeline.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select value={deal.seller?.id ?? ""}
                      onChange={(e) => assignSeller(deal.id, e.target.value)}
                      className="text-xs border-0 bg-transparent text-gray-600 focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 py-0.5 pr-5 cursor-pointer">
                      <option value="">— sem vendedor</option>
                      {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {deal.value ? formatCurrency(deal.value) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative inline-block">
                      <select value={deal.status}
                        disabled={updating === deal.id}
                        onChange={(e) => changeStatus(deal.id, e.target.value as "OPEN" | "WON" | "LOST")}
                        className={`appearance-none pl-6 pr-5 py-1 rounded-full text-xs font-medium cursor-pointer border-0 focus:outline-none focus:ring-1 focus:ring-ring ${cfg.bg} ${cfg.color}`}>
                        <option value="OPEN">Em aberto</option>
                        <option value="WON">Ganho</option>
                        <option value="LOST">Perdido</option>
                      </select>
                      <Icon className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${cfg.color}`} />
                      <ChevronDown className={`absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${cfg.color}`} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {deal.closedAt ? formatDate(deal.closedAt) : formatDate(deal.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={deal.contact ? `/crm/${deal.contact.id}` : "/crm"}
                      className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
