"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, Check, X } from "lucide-react"

interface Category { id: string; name: string; color: string; _count: { products: number } }

const PRESET_COLORS = ["#6366f1", "#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#ec4899", "#f97316", "#8b5cf6"]

export function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#6366f1")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")

  async function saveEdit(id: string) {
    await fetch("/api/estoque/categorias", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName, color: editColor }),
    })
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, name: editName, color: editColor } : c))
    setEditId(null)
    router.refresh()
  }

  async function addCategory() {
    if (!newName.trim()) return
    const res = await fetch("/api/estoque/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    const created = await res.json()
    setCategories((prev) => [...prev, { ...created, _count: { products: 0 } }])
    setNewName("")
    setAdding(false)
    router.refresh()
  }

  async function deleteCategory(id: string) {
    setError("")
    const res = await fetch(`/api/estoque/categorias?id=${id}`, { method: "DELETE" })
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id))
    } else {
      const err = await res.json()
      setError(err.error ?? "Erro ao excluir")
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Categorias de Produtos</h3>
          <p className="text-sm text-gray-500">Organize os produtos do estoque por categoria</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4 mr-1.5" /> Adicionar
        </Button>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />

            {editId === c.id ? (
              <>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm flex-1"
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(c.id)} />
                <div className="flex gap-1">
                  {PRESET_COLORS.map((col) => (
                    <button key={col} onClick={() => setEditColor(col)}
                      className={`w-5 h-5 rounded-full transition-transform ${editColor === col ? "ring-2 ring-offset-1 ring-gray-700 scale-110" : ""}`}
                      style={{ backgroundColor: col }} />
                  ))}
                </div>
                <button onClick={() => saveEdit(c.id)} className="p-1 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-gray-900">{c.name}</span>
                <span className="text-xs text-gray-400">{c._count.products} produto(s)</span>
                <button onClick={() => { setEditId(c.id); setEditName(c.name); setEditColor(c.color) }}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteCategory(c.id)}
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
              <Label className="text-xs">Nome da categoria</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Eletrônicos"
                className="h-8 text-sm" autoFocus onKeyDown={(e) => e.key === "Enter" && addCategory()} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor</Label>
              <div className="flex gap-2">
                {PRESET_COLORS.map((col) => (
                  <button key={col} onClick={() => setNewColor(col)}
                    className={`w-6 h-6 rounded-full transition-transform ${newColor === col ? "ring-2 ring-offset-1 ring-gray-700 scale-110" : ""}`}
                    style={{ backgroundColor: col }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addCategory} disabled={!newName.trim()}>Adicionar</Button>
              <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewName("") }}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
