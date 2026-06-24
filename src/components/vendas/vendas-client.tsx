"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate, getInitials } from "@/lib/utils"
import {
  Search, TrendingUp, TrendingDown, ExternalLink,
  CheckCircle2, XCircle, Circle, ChevronDown,
} from "lucide-react"

interface Seller { id: string; name: string | null }
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
}

interface Props {
  initialDeals: Deal[]
  sellers: Seller[]
}

const STATUS_CONFIG = {
  OPEN:  { label: "Em aberto",  icon: Circle,       color: "text-blue-600",  bg: "bg-blue-50"  },
  WON:   { label: "Ganho",      icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  LOST:  { label: "Perdido",    icon: XCircle,      color: "text-red-600",   bg: "bg-red-50"   },
}

export function VendasClient({ initialDeals, sellers }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [deals, setDeals] = useState(initialDeals)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [sellerFilter, setSellerFilter] = useState("")
  const [updating, setUpdating] = useState<string | null>(null)

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

      {/* Filters */}
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

        <Link href="/crm/pipeline" className="ml-auto flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
          <ExternalLink className="w-4 h-4" /> Ver Kanban
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Negócio</th>
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
              <tr><td colSpan={7} className="text-center py-14 text-gray-400">Nenhum negócio encontrado</td></tr>
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
                    <Link href={`/crm/${deal.contact?.id}`} className={`p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ${!deal.contact ? "pointer-events-none" : ""}`}>
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
