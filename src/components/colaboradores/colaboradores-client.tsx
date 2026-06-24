"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { formatDate, getInitials } from "@/lib/utils"
import { ROLE_LABELS, ROLE_COLORS, hasMinRole } from "@/lib/permissions"
import { Plus, Pencil, UserX, UserCheck, KeyRound, Search } from "lucide-react"
import type { Role } from "@prisma/client"

interface User {
  id: string
  name: string | null
  email: string
  role: Role
  active: boolean
  createdAt: string
  _count: { activities: number; deals: number }
}

interface Props {
  users: User[]
  currentUserId: string
  currentUserRole: Role
}

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"]),
})

const editSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  role: z.enum(["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"]),
  password: z.string().min(6).optional().or(z.literal("")),
})

type CreateData = z.infer<typeof createSchema>
type EditData = z.infer<typeof editSchema>

const ROLES: Role[] = ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"]

export function ColaboradoresClient({ users: initialUsers, currentUserId, currentUserRole }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [toggleUser, setToggleUser] = useState<User | null>(null)

  const canManage = hasMinRole(currentUserRole, "HEAD_LEADER")
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router])

  const { register: rCreate, handleSubmit: hCreate, reset: resetCreate, formState: { errors: eCreate, isSubmitting: sCreate } } = useForm<CreateData>({
    resolver: zodResolver(createSchema) as never,
    defaultValues: { role: "EMPLOYEE" },
  })

  const { register: rEdit, handleSubmit: hEdit, reset: resetEdit, formState: { errors: eEdit, isSubmitting: sEdit } } = useForm<EditData>({
    resolver: zodResolver(editSchema) as never,
  })

  async function onCreate(data: CreateData) {
    const res = await fetch("/api/colaboradores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const created = await res.json()
      setUsers((prev) => [...prev, { ...created, _count: { activities: 0, deals: 0 } }])
      setCreateOpen(false)
      resetCreate()
    } else {
      const err = await res.json()
      alert(err.error ?? "Erro ao criar colaborador")
    }
  }

  async function onEdit(data: EditData) {
    if (!editUser) return
    const payload: Record<string, unknown> = { name: data.name, role: data.role }
    if (data.password) payload.password = data.password

    const res = await fetch(`/api/colaboradores/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsers((prev) => prev.map((u) => u.id === editUser.id ? { ...u, ...updated } : u))
      setEditUser(null)
    }
  }

  async function confirmToggle() {
    if (!toggleUser) return
    const active = !toggleUser.active
    const res = await fetch(`/api/colaboradores/${toggleUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === toggleUser.id ? { ...u, active } : u))
    }
    setToggleUser(null)
  }

  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  return (
    <div className="p-6 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLES.slice(1).map((role) => {
          const count = users.filter((u) => u.role === role && u.active).length
          return (
            <div key={role} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">{ROLE_LABELS[role]}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input className="pl-8 h-9 w-64 text-sm" placeholder="Buscar por nome ou email..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo colaborador
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Colaborador</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Cargo</th>
              <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Atividades</th>
              <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Negócios</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Desde</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Status</th>
              {canManage && <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-14 text-gray-400">Nenhum colaborador encontrado</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.id} className={`border-b border-gray-50 transition-colors ${u.active ? "hover:bg-gray-50/50" : "opacity-50 bg-gray-50/30"}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                      {getInitials(u.name)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{u.name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    {u.id === currentUserId && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Você</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{u._count.activities}</td>
                <td className="px-4 py-3 text-center text-gray-600">{u._count.deals}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <button title="Editar"
                        onClick={() => { setEditUser(u); resetEdit({ name: u.name ?? "", role: u.role, password: "" }) }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {u.id !== currentUserId && (
                        <button title={u.active ? "Desativar" : "Reativar"}
                          onClick={() => setToggleUser(u)}
                          className={`p-1.5 rounded-lg transition-colors ${u.active ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}>
                          {u.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="mb-6"><SheetTitle>Novo Colaborador</SheetTitle></SheetHeader>
          <form onSubmit={hCreate(onCreate)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input {...rCreate("name")} placeholder="Nome completo" />
              {eCreate.name && <p className="text-red-500 text-xs">{eCreate.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input {...rCreate("email")} type="email" placeholder="email@empresa.com" />
              {eCreate.email && <p className="text-red-500 text-xs">{eCreate.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Senha *</Label>
              <Input {...rCreate("password")} type="password" placeholder="Mínimo 6 caracteres" />
              {eCreate.password && <p className="text-red-500 text-xs">{eCreate.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Cargo *</Label>
              <select {...rCreate("role")} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={sCreate}>{sCreate ? "Criando..." : "Criar colaborador"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit sheet */}
      <Sheet open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="mb-6"><SheetTitle>Editar Colaborador</SheetTitle></SheetHeader>
          {editUser && (
            <form onSubmit={hEdit(onEdit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input {...rEdit("name")} />
                {eEdit.name && <p className="text-red-500 text-xs">{eEdit.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <select {...rEdit("role")} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" />Nova senha</Label>
                <Input {...rEdit("password")} type="password" placeholder="Deixe em branco para não alterar" />
                {eEdit.password && <p className="text-red-500 text-xs">{eEdit.password.message}</p>}
              </div>
              <SheetFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
                <Button type="submit" disabled={sEdit}>{sEdit ? "Salvando..." : "Salvar"}</Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Toggle active dialog */}
      <AlertDialog open={!!toggleUser} onOpenChange={(o) => !o && setToggleUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleUser?.active ? "Desativar colaborador?" : "Reativar colaborador?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {toggleUser?.active
                ? `${toggleUser.name} perderá acesso ao sistema imediatamente.`
                : `${toggleUser?.name} voltará a ter acesso ao sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle}
              className={toggleUser?.active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}>
              {toggleUser?.active ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
