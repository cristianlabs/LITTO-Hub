"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CreditCheckDialog } from "./credit-check-dialog"
import { ContactFormSheet } from "@/components/crm/contact-form-sheet"
import { formatCurrency, getInitials, formatDate } from "@/lib/utils"
import {
  Search, TrendingUp, ExternalLink, Building2,
  Phone, Mail, DollarSign, Activity, CreditCard, Plus,
} from "lucide-react"

interface Deal { value: { toString(): string }; status: string }
interface Client {
  id: string; name: string; email?: string | null; phone?: string | null
  cpf?: string | null; cnpj?: string | null; razaoSocial?: string | null
  creditLimit?: number | null; createdAt: string | Date
  company?: { name: string } | null
  deals: Deal[]
  _count: { activities: number }
}

interface Props {
  clients: Client[]
  currentQ: string
}

function scoreColor(limit: number | null | undefined) {
  if (!limit) return "text-gray-400"
  if (limit >= 100000) return "text-green-600"
  if (limit >= 10000) return "text-blue-600"
  return "text-orange-600"
}

export function ClientesClient({ clients, currentQ }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(currentQ)
  const [creditCnpj, setCreditCnpj] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [showNovoCliente, setShowNovoCliente] = useState(false)

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router])

  function applySearch(q: string) {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    router.push(`${pathname}?${params.toString()}`)
  }

  async function applyCredit(clientId: string, data: { razaoSocial: string; creditLimit: number }) {
    setSavingId(clientId)
    await fetch("/api/clientes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: clientId, creditLimit: data.creditLimit }),
    })
    setSavingId(null)
    refresh()
  }

  const totalValue = clients.reduce((sum, c) => {
    const won = c.deals.filter((d) => d.status === "WON")
    return sum + won.reduce((s, d) => s + parseFloat(d.value.toString()), 0)
  }, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total de clientes", value: clients.length, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Com limite de crédito", value: clients.filter((c) => c.creditLimit && c.creditLimit > 0).length, icon: CreditCard, color: "text-green-600", bg: "bg-green-50" },
          { label: "Volume total (negócios ganhos)", value: formatCurrency(totalValue), icon: DollarSign, color: "text-purple-600", bg: "bg-purple-50", isText: true },
        ].map(({ label, value, icon: Icon, color, bg, isText }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`font-bold mt-0.5 ${isText ? "text-base text-gray-900" : "text-2xl text-gray-900"}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + link to CRM */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input className="pl-8 h-9 text-sm" placeholder="Buscar cliente, CNPJ, CPF..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch(search)} />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowNovoCliente(true)} className="h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Novo cliente
          </Button>
          <Link href="/crm" className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
            <ExternalLink className="w-4 h-4" /> Gerenciar no CRM
          </Link>
        </div>
      </div>

      {/* Table */}
      {clients.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-400">Nenhum cliente ativo encontrado</p>
          <p className="text-sm text-gray-400 mt-1">Clientes são contatos com status <strong>Ativo</strong> no CRM.</p>
          <Link href="/crm" className="inline-flex items-center gap-1.5 mt-4 text-sm text-blue-600 hover:underline">
            <ExternalLink className="w-4 h-4" /> Ir para o CRM
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Documento</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Contato</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Volume</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Limite crédito</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const wonValue = c.deals.filter((d) => d.status === "WON").reduce((s, d) => s + parseFloat(d.value.toString()), 0)
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                          {getInitials(c.razaoSocial || c.name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{c.razaoSocial || c.name}</p>
                          {c.razaoSocial && c.razaoSocial !== c.name && (
                            <p className="text-xs text-gray-400">{c.name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.cnpj ? (
                        <div>
                          <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-medium">CNPJ</span>
                          <p className="text-xs text-gray-600 font-mono mt-0.5">{c.cnpj}</p>
                        </div>
                      ) : c.cpf ? (
                        <div>
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono font-medium">CPF</span>
                          <p className="text-xs text-gray-600 font-mono mt-0.5">{c.cpf}</p>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {c.email && <div className="flex items-center gap-1 text-xs text-gray-500"><Mail className="w-3 h-3" />{c.email}</div>}
                        {c.phone && <div className="flex items-center gap-1 text-xs text-gray-500"><Phone className="w-3 h-3" />{c.phone}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium text-gray-900">{formatCurrency(wonValue)}</p>
                      <p className="text-xs text-gray-400">{c.deals.length} negócio(s)</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.creditLimit ? (
                        <p className={`font-semibold ${scoreColor(c.creditLimit)}`}>{formatCurrency(c.creditLimit)}</p>
                      ) : (
                        <span className="text-gray-300 text-xs">Não definido</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {c.cnpj && (
                          <button
                            title="Verificar crédito"
                            onClick={() => setCreditCnpj(`${c.id}::${c.cnpj}`)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                        )}
                        <Link href={`/crm/${c.id}`} title="Ver no CRM"
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <Activity className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ContactFormSheet
        open={showNovoCliente}
        onOpenChange={setShowNovoCliente}
        defaultStatus="ACTIVE"
        onSaved={() => { setShowNovoCliente(false); refresh() }}
      />

      {/* Credit check dialog */}
      {creditCnpj && (() => {
        const [clientId, cnpj] = creditCnpj.split("::")
        return (
          <CreditCheckDialog
            open
            onOpenChange={(o) => !o && setCreditCnpj(null)}
            cnpj={cnpj}
            onApply={(data) => {
              applyCredit(clientId, data)
              setCreditCnpj(null)
            }}
          />
        )
      })()}
    </div>
  )
}
