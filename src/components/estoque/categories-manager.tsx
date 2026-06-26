"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Tag, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface Category {
  id: string
  name: string
  color: string
  _count?: { products: number }
}

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#6b7280",
]

interface Props {
  open: boolean
  onClose: () => void
  onRefresh: () => void
}

export function CategoriesManager({ open, onClose, onRefresh }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState("#6366f1")
  const [error, setError] = useState("")

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/estoque/categorias")
    if (res.ok) setCategories(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open) fetchCategories()
  }, [open, fetchCategories])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError("")
    const res = await fetch("/api/estoque/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color }),
    })
    if (res.ok) {
      setName("")
      setColor("#6366f1")
      fetchCategories()
      onRefresh()
    } else {
      const data = await res.json()
      setError(data.error?.fieldErrors?.name?.[0] ?? "Erro ao criar categoria")
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const res = await fetch(`/api/estoque/categorias?id=${deleteTarget.id}`, { method: "DELETE" })
    if (res.ok) {
      setDeleteTarget(null)
      fetchCategories()
      onRefresh()
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-500" />
              Categorias de Estoque
            </DialogTitle>
          </DialogHeader>

          {/* Create form */}
          <form onSubmit={handleCreate} className="space-y-3 pb-3 border-b border-gray-100">
            <div className="space-y-1.5">
              <Label>Nova categoria</Label>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Eletrônicos"
                  className="flex-1"
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
                  className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: color }}
                >
                  Prévia
                </span>
              </div>
            </div>
          </form>

          {/* List */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma categoria criada</p>
            ) : (
              categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                    <span className="text-xs text-gray-400">
                      {cat._count?.products ?? 0} produto{(cat._count?.products ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title="Excluir categoria"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>"{deleteTarget?.name}"</strong>?
              {(deleteTarget?._count?.products ?? 0) > 0 && (
                <span className="block mt-1 text-amber-600">
                  Esta categoria está em uso por {deleteTarget?._count?.products} produto(s). Os produtos ficarão sem categoria.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
