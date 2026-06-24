"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, Check, X, Building2 } from "lucide-react"

interface Supplier {
  id: string; name: string; cnpj?: string | null
  email?: string | null; phone?: string | null; _count: { products: number }
}

const emptyForm = { name: "", cnpj: "", email: "", phone: "", contact: "" }

export function SupplierManager({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState(emptyForm)
  const [newData, setNewData] = useState(emptyForm)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")

  async function saveEdit(id: string) {
    await fetch("/api/estoque/fornecedores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...editData }),
    })
    setSuppliers((prev) =>
      prev.map((s) => s.id === id ? { ...s, name: editData.name, email: editData.email || null, phone: editData.phone || null, cnpj: editData.cnpj || null } : s),
    )
    setEditId(null)
    router.refresh()
  }

  async function addSupplier() {
    if (!newData.name.trim()) return
    const res = await fetch("/api/estoque/fornecedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newData),
    })
    const created = await res.json()
    setSuppliers((prev) => [...prev, { ...created, _count: { products: 0 } }])
    setNewData(emptyForm)
    setAdding(false)
    router.refresh()
  }

  async function deleteSupplier(id: string) {
    setError("")
    const res = await fetch(`/api/estoque/fornecedores?id=${id}`, { method: "DELETE" })
    if (res.ok) {
      setSuppliers((prev) => prev.filter((s) => s.id !== id))
    } else {
      const err = await res.json()
      setError(err.error ?? "Erro ao excluir")
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Fornecedores</h3>
          <p className="text-sm text-gray-500">Cadastro de fornecedores de produtos</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4 mr-1.5" /> Adicionar
        </Button>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="space-y-2">
        {suppliers.map((s) => (
          <div key={s.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            {editId === s.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Nome *</Label>
                    <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">CNPJ</Label>
                    <Input value={editData.cnpj} onChange={(e) => setEditData({ ...editData, cnpj: e.target.value })} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label>
                    <Input value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Telefone</Label>
                    <Input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="h-8 text-sm" /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(s.id)}>Salvar</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {s.cnpj && <span className="text-xs text-gray-400">{s.cnpj}</span>}
                    {s.email && <span className="text-xs text-gray-400">{s.email}</span>}
                    {s.phone && <span className="text-xs text-gray-400">{s.phone}</span>}
                  </div>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{s._count.products} produto(s)</span>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => { setEditId(s.id); setEditData({ name: s.name, cnpj: s.cnpj ?? "", email: s.email ?? "", phone: s.phone ?? "", contact: "" }) }}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteSupplier(s.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding && (
          <div className="bg-white border-2 border-blue-200 rounded-xl px-4 py-4 space-y-3">
            <p className="text-sm font-medium text-gray-900">Novo fornecedor</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Nome *</Label>
                <Input value={newData.name} onChange={(e) => setNewData({ ...newData, name: e.target.value })}
                  placeholder="Nome da empresa" className="h-8 text-sm" autoFocus /></div>
              <div className="space-y-1"><Label className="text-xs">CNPJ</Label>
                <Input value={newData.cnpj} onChange={(e) => setNewData({ ...newData, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00" className="h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Email</Label>
                <Input value={newData.email} onChange={(e) => setNewData({ ...newData, email: e.target.value })}
                  placeholder="vendas@empresa.com" className="h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Telefone</Label>
                <Input value={newData.phone} onChange={(e) => setNewData({ ...newData, phone: e.target.value })}
                  placeholder="(11) 00000-0000" className="h-8 text-sm" /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addSupplier} disabled={!newData.name.trim()}>Adicionar</Button>
              <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewData(emptyForm) }}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
