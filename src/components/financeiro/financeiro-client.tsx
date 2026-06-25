"use client"

import { useState } from "react"
import { ContasPagar } from "./contas-pagar"
import { ContasReceber } from "./contas-receber"
import { Planejamento } from "./planejamento"
import { Tesouraria } from "./tesouraria"
import { CreditCard, ArrowDownCircle, BarChart3, Landmark } from "lucide-react"

const tabs = [
  { key: "pagar", label: "Contas a Pagar", icon: CreditCard },
  { key: "receber", label: "Contas a Receber", icon: ArrowDownCircle },
  { key: "planejamento", label: "Planejamento e Controle", icon: BarChart3 },
  { key: "tesouraria", label: "Tesouraria", icon: Landmark },
]

export function FinanceiroClient({ bills, receivables, budgets, actualData, bankAccounts, flowData, year, month }: {
  bills: never[]
  receivables: never[]
  budgets: never[]
  actualData: never[]
  bankAccounts: never[]
  flowData: never
  year: number
  month: number
}) {
  const [tab, setTab] = useState("pagar")

  return (
    <div className="p-6 space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "pagar" && <ContasPagar initialBills={bills} bankAccounts={bankAccounts} />}
      {tab === "receber" && <ContasReceber initialReceivables={receivables} bankAccounts={bankAccounts} />}
      {tab === "planejamento" && <Planejamento initialBudgets={budgets} actualData={actualData} year={year} month={month} />}
      {tab === "tesouraria" && <Tesouraria initialAccounts={bankAccounts} initialFlow={flowData as never} />}
    </div>
  )
}
