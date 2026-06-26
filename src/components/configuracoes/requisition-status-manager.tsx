"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Loader2, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface CustomStatus {
  id: string
  name: string
  color: string
  order: number
  _count?: { requisitions: number }
}

const SYSTEM_STATUSES = [
  { key: "DRAFT", label: "Rascunho", color: "#9ca3af" },
  { key: "OPEN", label: "Aberto", color: "#3b82f6" },
  { key: "IN_REVIEW", label: "Em revisão", color: "#f59e0b" },
  { key: "APPROVED", label: "Aprovado", color: "#22c55e" },
  { key: "REJECTED", label: "Rejeitado", color: "#ef4444" },
  { key: "DONE", label: "Concluído", color: "#8b5cf6" },
]

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#6b7280",
]

export function RequisitionStatusManager() {
  const [statuses, setStatuses] = useState<CustomStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CustomStatus | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState("#6366f1")
  const [error, setError] = useState("")

  const fetchStatuses = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/requisicoes/status-personalizados")
    if (res.ok) setStatuses(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchStatuses() }, [fetchStatuses])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError("")
    const res = await fetch("/api/requisicoes/status-personalizados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color, order: statuses.length }),
    })
    if (res.ok) {
      setName("")
      setColor("#6366f1")
      fetchStatuses()
    } else {
      const data = await res.json()
      setError(data.error?.fieldErrors?.name?.[0] ?? "Já existe um status com esse nome")
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await fetch(`/api/requisicoes/status-personalizados?id=${deleteTarget.id}`, { method: "DELETE" })
    setDeleteTarget(null)
    fetchStatuses()
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* System statuses (read-only) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-gray-400" />
          Status do sistema (padrão)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SYSTEM_STATUSES.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-sm text-gray-700 truncate">{s.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Os status padrão não podem ser removidos.</p>
      </div>

      {/* Custom statuses */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-gray-400" />
          Status personalizados
        </h3>

        {/* Create form */}
        <form onSubmit={handleCreate} className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-xl mb-4">
          <div className="space-y-1.5">
            <Label>Nome do status</Label>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Aguardando fornecedor"
                className="flex-1"
                maxLength={50}
              />
              <Button type="submit" size="sm" disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer p-0 overflow-hidden"
                title="Cor personalizada"
              />
              <span
                className="ml-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: color }}
              >
                {name || "Prévia"}
              </span>
            </div>
          </div>
        </form>

        {/* List */}
        <div className="space-y-1.5">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : statuses.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl py-8 text-center">
              <p className="text-sm text-gray-400">Nenhum status personalizado criado</p>
              <p className="text-xs text-gray-300 mt-1">Preencha o formulário acima para adicionar</p>
            </div>
          ) : (
            statuses.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2.5 bg-white border border-gray-100 rounded-lg hover:bg-gray-50 group"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-sm font-medium text-gray-800">{s.name}</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: s.color }}
                  >
                    {s._count?.requisitions ?? 0} req{(s._count?.requisitions ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={() => setDeleteTarget(s)}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="Excluir status"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir status</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>"{deleteTarget?.name}"</strong>?
              {(deleteTarget?._count?.requisitions ?? 0) > 0 && (
                <span className="block mt-1 text-amber-600">
                  Este status está em uso em {deleteTarget?._count?.requisitions} requisição(ões). Elas voltarão a exibir apenas o status padrão.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
