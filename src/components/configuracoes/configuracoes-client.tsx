"use client"

import { useState } from "react"
import { PipelineManager } from "./pipeline-manager"
import { CategoryManager } from "./category-manager"
import { SupplierManager } from "./supplier-manager"
import { AlertsConfig } from "./alerts-config"
import { Settings, GitMerge, Tag, Truck, Bell } from "lucide-react"

interface Pipeline { id: string; name: string; color: string; order: number; _count: { deals: number } }
interface Category { id: string; name: string; color: string; _count: { products: number } }
interface Supplier { id: string; name: string; cnpj?: string | null; email?: string | null; phone?: string | null; _count: { products: number } }
interface AlertConfig { email: boolean; push: boolean; inApp: boolean }

interface Props {
  pipelines: Pipeline[]
  categories: Category[]
  suppliers: Supplier[]
  alertConfig: AlertConfig
}

const tabs = [
  { key: "pipelines", label: "Pipelines CRM", icon: GitMerge },
  { key: "categories", label: "Categorias", icon: Tag },
  { key: "suppliers", label: "Fornecedores", icon: Truck },
  { key: "alerts", label: "Alertas de Estoque", icon: Bell },
]

export function ConfiguracoesClient({ pipelines, categories, suppliers, alertConfig }: Props) {
  const [tab, setTab] = useState("pipelines")

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <Settings className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Configurações do Sistema</h2>
          <p className="text-sm text-gray-500">Gerencie pipelines, categorias, fornecedores e alertas</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
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

      {tab === "pipelines" && <PipelineManager initialPipelines={pipelines} />}
      {tab === "categories" && <CategoryManager initialCategories={categories} />}
      {tab === "suppliers" && <SupplierManager initialSuppliers={suppliers} />}
      {tab === "alerts" && <AlertsConfig initialConfig={alertConfig} />}
    </div>
  )
}
