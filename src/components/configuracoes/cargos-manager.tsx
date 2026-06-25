"use client"

import { useState, useCallback, useEffect } from "react"
import { Plus, Pencil, Trash2, Save, X, Users, Briefcase, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type BaseRole = "OWNER" | "HEAD_LEADER" | "MANAGER" | "SELLER" | "EMPLOYEE"

interface CustomRole {
  id: string
  name: string
  baseRole: BaseRole
  color: string
  description: string | null
  _count: { users: number }
}

const BASE_ROLE_LABELS: Record<BaseRole, string> = {
  OWNER: "Proprietário",
  HEAD_LEADER: "Líder Geral",
  MANAGER: "Gerente",
  SELLER: "Vendedor",
  EMPLOYEE: "Colaborador",
}

const BASE_ROLE_COLORS: Record<BaseRole, string> = {
  OWNER: "#7C3AED",
  HEAD_LEADER: "#DC2626",
  MANAGER: "#D97706",
  SELLER: "#16A34A",
  EMPLOYEE: "#6B7280",
}

const PRESET_COLORS = [
  "#6B7280", "#EF4444", "#F97316", "#EAB308",
  "#22C55E", "#14B8A6", "#3B82F6", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F59E0B",
]

interface FormState {
  name: string
  baseRole: BaseRole
  color: string
  description: string
}

const EMPTY_FORM: FormState = { name: "", baseRole: "EMPLOYEE", color: "#6B7280", description: "" }

export function CargosManager({ isOwner }: { isOwner: boolean }) {
  const [cargos, setCargos] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/configuracoes/cargos")
      if (res.ok) setCargos(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(cargo: CustomRole) {
    setEditingId(cargo.id)
    setShowNew(false)
    setForm({ name: cargo.name, baseRole: cargo.baseRole, color: cargo.color, description: cargo.description ?? "" })
  }

  function startNew() {
    setShowNew(true)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function cancel() {
    setShowNew(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch("/api/configuracoes/cargos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...form }),
        })
        if (res.ok) { await load(); cancel() }
      } else {
        const res = await fetch("/api/configuracoes/cargos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (res.ok) { await load(); cancel() }
      }
    } finally { setSaving(false) }
  }

  async function deleteCargo(id: string) {
    const res = await fetch(`/api/configuracoes/cargos?id=${id}`, { method: "DELETE" })
    if (res.ok) { await load(); setDeleteId(null) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Cargos personalizados</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Crie cargos com nomes customizados mapeados para os níveis de permissão do sistema.
          </p>
        </div>
        {isOwner && !showNew && (
          <Button size="sm" onClick={startNew}>
            <Plus className="w-4 h-4 mr-1.5" />
            Novo cargo
          </Button>
        )}
      </div>

      {/* New form */}
      {showNew && isOwner && (
        <CargoForm
          form={form}
          setForm={setForm}
          onSave={save}
          onCancel={cancel}
          saving={saving}
          title="Novo cargo"
        />
      )}

      {/* Base roles info */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Níveis base do sistema</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {(Object.entries(BASE_ROLE_LABELS) as [BaseRole, string][]).map(([role, label]) => (
            <div key={role} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BASE_ROLE_COLORS[role] }} />
              <span className="text-sm text-gray-700 font-medium truncate">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom roles list */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Cargos personalizados ({cargos.length})
        </p>

        {loading ? (
          <p className="text-sm text-gray-400 py-6 text-center">Carregando...</p>
        ) : cargos.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl py-12 text-center">
            <Briefcase className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium text-sm">Nenhum cargo personalizado</p>
            {isOwner && (
              <p className="text-gray-400 text-xs mt-1">Clique em "Novo cargo" para começar</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {cargos.map((cargo) => (
              <div key={cargo.id}>
                {editingId === cargo.id ? (
                  <CargoForm
                    form={form}
                    setForm={setForm}
                    onSave={save}
                    onCancel={cancel}
                    saving={saving}
                    title="Editar cargo"
                  />
                ) : (
                  <div className="flex items-center gap-4 px-4 py-3.5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors group">
                    {/* Color dot */}
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cargo.color }} />

                    {/* Name + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{cargo.name}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: cargo.color + "20", color: cargo.color }}
                        >
                          {BASE_ROLE_LABELS[cargo.baseRole]}
                        </span>
                      </div>
                      {cargo.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{cargo.description}</p>
                      )}
                    </div>

                    {/* Users count */}
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Users className="w-3.5 h-3.5" />
                      {cargo._count.users}
                    </div>

                    {/* Actions */}
                    {isOwner && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(cargo)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(cargo.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Delete confirm */}
                {deleteId === cargo.id && (
                  <div className="mt-1 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                    <span className="text-red-700 flex-1">
                      Excluir <strong>{cargo.name}</strong>? Colaboradores perderão este cargo.
                    </span>
                    <button onClick={() => deleteCargo(cargo.id)} className="font-medium text-red-600 hover:text-red-700">Excluir</button>
                    <button onClick={() => setDeleteId(null)} className="text-gray-500 hover:text-gray-700">Cancelar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Cargo Form ────────────────────────────────────────────────────────────────

function CargoForm({
  form, setForm, onSave, onCancel, saving, title,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onSave: () => void
  onCancel: () => void
  saving: boolean
  title: string
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nome do cargo</Label>
          <Input
            placeholder="Ex: Analista de Vendas"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Nível de permissão</Label>
          <div className="relative">
            <select
              value={form.baseRole}
              onChange={(e) => setForm((f) => ({ ...f, baseRole: e.target.value as BaseRole }))}
              className="w-full h-9 rounded-md border border-input bg-white px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {(Object.entries(BASE_ROLE_LABELS) as [BaseRole, string][]).map(([role, label]) => (
                <option key={role} value={role}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Descrição (opcional)</Label>
        <Input
          placeholder="Ex: Responsável pela prospecção de novos clientes"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Cor do cargo</Label>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`w-7 h-7 rounded-lg transition-transform ${form.color === c ? "ring-2 ring-offset-1 ring-gray-800 scale-110" : "hover:scale-105"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="w-8 h-8 rounded cursor-pointer border-0"
            title="Cor personalizada"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-2 pt-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: form.color }} />
        <span
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ background: form.color + "20", color: form.color }}
        >
          {form.name || "Preview do cargo"}
        </span>
        <span className="text-xs text-gray-400">→ permissões de {BASE_ROLE_LABELS[form.baseRole]}</span>
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave} disabled={saving || !form.name.trim()}>
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
