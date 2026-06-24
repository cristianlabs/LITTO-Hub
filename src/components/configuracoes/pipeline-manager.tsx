"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, Check, X, GripVertical } from "lucide-react"

interface Pipeline { id: string; name: string; color: string; order: number; _count: { deals: number } }

const PRESET_COLORS = ["#6366f1", "#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#ec4899", "#f97316", "#8b5cf6"]

export function PipelineManager({ initialPipelines }: { initialPipelines: Pipeline[] }) {
  const router = useRouter()
  const [pipelines, setPipelines] = useState(initialPipelines)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#6366f1")
  const [error, setError] = useState("")
  const [adding, setAdding] = useState(false)

  async function saveEdit(id: string) {
    await fetch("/api/configuracoes/pipelines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName, color: editColor }),
    })
    setPipelines((prev) => prev.map((p) => p.id === id ? { ...p, name: editName, color: editColor } : p))
    setEditId(null)
    router.refresh()
  }

  async function addPipeline() {
    if (!newName.trim()) return
    const res = await fetch("/api/configuracoes/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    const created = await res.json()
    setPipelines((prev) => [...prev, { ...created, _count: { deals: 0 } }])
    setNewName("")
    setAdding(false)
    router.refresh()
  }

  async function deletePipeline(id: string) {
    setError("")
    const res = await fetch(`/api/configuracoes/pipelines?id=${id}`, { method: "DELETE" })
    if (res.ok) {
      setPipelines((prev) => prev.filter((p) => p.id !== id))
      router.refresh()
    } else {
      const err = await res.json()
      setError(err.error ?? "Erro ao excluir")
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Pipelines de Vendas</h3>
          <p className="text-sm text-gray-500">Etapas do funil de vendas do CRM</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4 mr-1.5" /> Adicionar
        </Button>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="space-y-2">
        {pipelines.map((p) => (
          <div key={p.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
            <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />

            {editId === p.id ? (
              <>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-sm flex-1" onKeyDown={(e) => e.key === "Enter" && saveEdit(p.id)} />
                <div className="flex gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => setEditColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform ${editColor === c ? "ring-2 ring-offset-1 ring-gray-700 scale-110" : ""}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <button onClick={() => saveEdit(p.id)} className="p-1 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-gray-900">{p.name}</span>
                <span className="text-xs text-gray-400">{p._count.deals} negócio(s)</span>
                <button onClick={() => { setEditId(p.id); setEditName(p.name); setEditColor(p.color) }}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deletePipeline(p.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}

        {adding && (
          <div className="bg-white border-2 border-blue-200 rounded-xl px-4 py-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da etapa</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Em negociação"
                className="h-8 text-sm" autoFocus onKeyDown={(e) => e.key === "Enter" && addPipeline()} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor</Label>
              <div className="flex gap-2">
                {PRESET_COLORS.map((c) => (
                  <button key={c} onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform ${newColor === c ? "ring-2 ring-offset-1 ring-gray-700 scale-110" : ""}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addPipeline} disabled={!newName.trim()}>Adicionar</Button>
              <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewName("") }}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
