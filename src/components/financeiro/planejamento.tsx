"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Save, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { BILL_CATEGORIES } from "@/lib/financeiro-constants"

interface Budget { id: string; year: number; month: number; category: string; planned: number }
interface ActualData { category: string; paid: number; received: number }

interface Props {
  initialBudgets: Budget[]
  actualData: ActualData[]
  year: number
  month: number
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

export function Planejamento({ initialBudgets, actualData, year: initialYear, month: initialMonth }: Props) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [budgets, setBudgets] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    initialBudgets.forEach((b) => { map[b.category] = b.planned })
    return map
  })
  const [actual, setActual] = useState(actualData)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  async function loadData(y: number, m: number) {
    setLoading(true)
    const [budgetRes, billRes, recRes] = await Promise.all([
      fetch(`/api/financeiro/orcamento?year=${y}&month=${m}`),
      fetch(`/api/financeiro/contas-pagar?from=${y}-${String(m).padStart(2, "0")}-01&to=${y}-${String(m).padStart(2, "0")}-31`),
      fetch(`/api/financeiro/contas-receber?from=${y}-${String(m).padStart(2, "0")}-01&to=${y}-${String(m).padStart(2, "0")}-31`),
    ])
    const [budgetsData, bills, receivables] = await Promise.all([budgetRes.json(), billRes.json(), recRes.json()])

    const newBudgets: Record<string, number> = {}
    budgetsData.forEach((b: Budget) => { newBudgets[b.category] = b.planned })
    setBudgets(newBudgets)

    const catMap: Record<string, { paid: number; received: number }> = {}
    bills.forEach((b: { category: string; amount: number; status: string }) => {
      if (!catMap[b.category]) catMap[b.category] = { paid: 0, received: 0 }
      if (b.status === "PAID") catMap[b.category].paid += b.amount
    })
    receivables.forEach((r: { category: string; amount: number; status: string }) => {
      if (!catMap[r.category]) catMap[r.category] = { paid: 0, received: 0 }
      if (r.status === "RECEIVED") catMap[r.category].received += r.amount
    })
    setActual(Object.entries(catMap).map(([category, v]) => ({ category, ...v })))
    setLoading(false)
  }

  async function changeMonth(y: number, m: number) {
    setYear(y); setMonth(m)
    await loadData(y, m)
  }

  async function saveBudgets() {
    setSaving(true)
    await Promise.all(
      Object.entries(budgets).map(([category, planned]) =>
        fetch("/api/financeiro/orcamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, month, category, planned }) })
      )
    )
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const totalPlanned = BILL_CATEGORIES.reduce((s, c) => s + (budgets[c] ?? 0), 0)
  const totalActual = actual.reduce((s, a) => s + a.paid, 0)
  const totalReceived = actual.reduce((s, a) => s + a.received, 0)
  const surplus = totalReceived - totalActual

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => changeMonth(year, Number(e.target.value))} className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => changeMonth(Number(e.target.value), month)} className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {loading && <span className="text-xs text-gray-400">Carregando...</span>}
        </div>
        <Button size="sm" onClick={saveBudgets} disabled={saving}>
          <Save className="w-3.5 h-3.5 mr-1.5" />{saved ? "Salvo!" : saving ? "Salvando..." : "Salvar orçamento"}
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Orçado (despesas)", value: formatCurrency(totalPlanned), sub: "planejado", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          { label: "Realizado (despesas)", value: formatCurrency(totalActual), sub: "contas pagas", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
          { label: "Receita realizada", value: formatCurrency(totalReceived), sub: "contas recebidas", color: "text-green-700", bg: "bg-green-50 border-green-200" },
          { label: "Resultado", value: formatCurrency(surplus), sub: surplus >= 0 ? "superávit" : "déficit", color: surplus >= 0 ? "text-green-700" : "text-red-700", bg: surplus >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200" },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
            <p className={`text-xs font-medium ${k.color} mb-1`}>{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Budget table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <p className="font-semibold text-gray-800 text-sm">Orçamento vs. Realizado — {MONTHS[month - 1]} {year}</p>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100">
            <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Categoria</th>
            <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Orçado</th>
            <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Realizado</th>
            <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Variação</th>
            <th className="px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide w-40">Progresso</th>
          </tr></thead>
          <tbody>
            {BILL_CATEGORIES.map((cat, idx) => {
              const planned = budgets[cat] ?? 0
              const actualVal = actual.find((a) => a.category === cat)?.paid ?? 0
              const diff = planned - actualVal
              const pct = planned > 0 ? Math.min(Math.round((actualVal / planned) * 100), 100) : 0
              const overBudget = actualVal > planned && planned > 0

              return (
                <tr key={cat} className={`border-b border-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">{cat}</td>
                  <td className="px-5 py-3 text-right">
                    <input
                      type="number" min="0" step="0.01"
                      value={planned || ""}
                      onChange={(e) => setBudgets((p) => ({ ...p, [cat]: Number(e.target.value) || 0 }))}
                      className="w-32 text-right rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      placeholder="0,00"
                    />
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{actualVal > 0 ? formatCurrency(actualVal) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-3 text-right">
                    {planned === 0 && actualVal === 0 ? <span className="text-gray-300">—</span> : (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${overBudget ? "text-red-600" : diff === 0 ? "text-gray-500" : "text-green-600"}`}>
                        {overBudget ? <TrendingUp className="w-3 h-3" /> : diff === 0 ? <Minus className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {overBudget ? "+" : ""}{formatCurrency(Math.abs(diff))}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {planned > 0 ? (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-400">{pct}%</span>
                          {overBudget && <span className="text-red-500 text-[10px] font-medium">Estouro</span>}
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100">
                          <div className={`h-full rounded-full transition-all ${overBudget ? "bg-red-500" : pct > 80 ? "bg-orange-400" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ) : <span className="text-gray-300 text-xs">Sem orçamento</span>}
                  </td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <td className="px-5 py-3 text-gray-900">Total</td>
              <td className="px-5 py-3 text-right text-gray-900">{formatCurrency(totalPlanned)}</td>
              <td className="px-5 py-3 text-right text-gray-900">{formatCurrency(totalActual)}</td>
              <td className="px-5 py-3 text-right">
                <span className={`text-sm font-semibold ${totalActual > totalPlanned ? "text-red-600" : "text-green-600"}`}>
                  {totalActual > totalPlanned ? "+" : "-"}{formatCurrency(Math.abs(totalPlanned - totalActual))}
                </span>
              </td>
              <td className="px-5 py-3" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
