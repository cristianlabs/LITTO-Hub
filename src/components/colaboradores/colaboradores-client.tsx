"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { formatDate, getInitials } from "@/lib/utils"
import { ROLE_LABELS, ROLE_COLORS, hasMinRole } from "@/lib/permissions"
import { Plus, Pencil, UserX, UserCheck, KeyRound, Search, ChevronDown, Info, Briefcase } from "lucide-react"
import type { Role } from "@prisma/client"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomRole {
  id: string
  name: string
  color: string
  baseRole: Role
}

interface User {
  id: string
  name: string | null
  email: string
  role: Role
  customRole: CustomRole | null
  active: boolean
  createdAt: string
  _count: { activities: number; deals: number }
}

interface Props {
  users: User[]
  customRoles: CustomRole[]
  currentUserId: string
  currentUserRole: Role
}

const BASE_ROLES: Role[] = ["OWNER", "HEAD_LEADER", "MANAGER", "SELLER", "EMPLOYEE"]

// ─── Component ────────────────────────────────────────────────────────────────

export function ColaboradoresClient({ users: initialUsers, customRoles, currentUserId, currentUserRole }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState("")
  const [filterRole, setFilterRole] = useState<"all" | Role>("all")

  // Sheet state
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [toggleUser, setToggleUser] = useState<User | null>(null)

  const canManage = hasMinRole(currentUserRole, "HEAD_LEADER")
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router])

  // ── Create form state ──
  const [createForm, setCreateForm] = useState({
    name: "", email: "", password: "", role: "EMPLOYEE" as Role, customRoleId: "",
  })
  const [createError, setCreateError] = useState("")
  const [creating, setCreating] = useState(false)

  // ── Edit form state ──
  const [editForm, setEditForm] = useState({
    name: "", role: "EMPLOYEE" as Role, customRoleId: "", password: "",
  })
  const [editError, setEditError] = useState("")
  const [saving, setSaving] = useState(false)

  // ── Derived label for a user ──
  function userLabel(u: User) {
    return u.customRole?.name ?? ROLE_LABELS[u.role]
  }
  function userColor(u: User) {
    return u.customRole?.color ?? undefined
  }

  // ── Create ──
  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError("")
    try {
      const res = await fetch("/api/colaboradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          email: createForm.email,
          password: createForm.password,
          role: createForm.role,
          customRoleId: createForm.customRoleId || null,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setUsers((prev) => [...prev, { ...created, createdAt: created.createdAt ?? new Date().toISOString(), _count: { activities: 0, deals: 0 } }])
        setCreateOpen(false)
        setCreateForm({ name: "", email: "", password: "", role: "EMPLOYEE", customRoleId: "" })
      } else {
        const err = await res.json()
        setCreateError(err.error ?? "Erro ao criar colaborador")
      }
    } finally { setCreating(false) }
  }

  // ── Edit ──
  function openEdit(u: User) {
    setEditUser(u)
    setEditForm({
      name: u.name ?? "",
      role: u.role,
      customRoleId: u.customRole?.id ?? "",
      password: "",
    })
    setEditError("")
  }

  async function onEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setSaving(true)
    setEditError("")
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name,
        customRoleId: editForm.customRoleId || null,
      }
      // Only include role if no customRole set
      if (!editForm.customRoleId) payload.role = editForm.role
      if (editForm.password) payload.password = editForm.password

      const res = await fetch(`/api/colaboradores/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const updated = await res.json()
        setUsers((prev) => prev.map((u) => u.id === editUser.id ? { ...u, ...updated } : u))
        setEditUser(null)
      } else {
        const err = await res.json()
        setEditError(err.error ?? "Erro ao salvar")
      }
    } finally { setSaving(false) }
  }

  // ── Toggle active ──
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

  // ── Filtering ──
  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    const matchSearch = !search || u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRole = filterRole === "all" || u.role === filterRole
    return matchSearch && matchRole
  })

  // ── Summary counts ──
  const totalActive = users.filter((u) => u.active).length
  const roleCount = (r: Role) => users.filter((u) => u.role === r && u.active).length

  // ── Custom role select helper ──
  function CustomRoleSelect({
    value, onChange, roleValue, onRoleChange,
  }: {
    value: string
    onChange: (id: string) => void
    roleValue: Role
    onRoleChange: (r: Role) => void
  }) {
    const selectedCustom = customRoles.find((c) => c.id === value)

    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            Cargo personalizado
          </Label>
          <div className="relative">
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-white px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Nenhum (usar nível base) —</option>
              {customRoles.map((cr) => (
                <option key={cr.id} value={cr.id}>{cr.name} ({ROLE_LABELS[cr.baseRole]})</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          {selectedCustom && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: selectedCustom.color }} />
              <span>Nível de permissão: <strong>{ROLE_LABELS[selectedCustom.baseRole]}</strong></span>
            </div>
          )}
        </div>

        {!value && (
          <div className="space-y-1.5">
            <Label>Nível de permissão base</Label>
            <div className="relative">
              <select
                value={roleValue}
                onChange={(e) => onRoleChange(e.target.value as Role)}
                className="w-full h-9 rounded-md border border-input bg-white px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {BASE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        {customRoles.length === 0 && (
          <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-2.5 border border-gray-100">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Nenhum cargo personalizado criado ainda. Crie em Configurações → Cargos.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 lg:col-span-1">
          <p className="text-xs text-gray-500">Total ativos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalActive}</p>
        </div>
        {BASE_ROLES.slice(1).map((role) => (
          <div key={role} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">{ROLE_LABELS[role]}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{roleCount(role)}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            className="pl-8 h-9 w-56 text-sm"
            placeholder="Buscar nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="relative">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as "all" | Role)}
            className="h-9 pl-3 pr-8 rounded-md border border-input bg-white text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Todos os níveis</option>
            {BASE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        <div className="ml-auto">
          {canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Novo colaborador
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Colaborador</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Cargo</th>
              <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide hidden md:table-cell">Atividades</th>
              <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide hidden md:table-cell">Negócios</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide hidden lg:table-cell">Desde</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Status</th>
              {canManage && <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-14 text-gray-400 text-sm">
                  Nenhum colaborador encontrado
                </td>
              </tr>
            ) : filtered.map((u) => {
              const color = userColor(u)
              const label = userLabel(u)
              return (
                <tr
                  key={u.id}
                  className={`border-b border-gray-50 transition-colors ${u.active ? "hover:bg-gray-50/50" : "opacity-50 bg-gray-50/30"}`}
                >
                  {/* Avatar + info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                        {getInitials(u.name)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 flex items-center gap-1.5">
                          {u.name ?? "—"}
                          {u.id === currentUserId && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Você</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Cargo */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {color ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium w-fit"
                          style={{ background: color + "20", color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                          {label}
                        </span>
                      ) : (
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium w-fit ${ROLE_COLORS[u.role]}`}>
                          {label}
                        </span>
                      )}
                      {u.customRole && (
                        <span className="text-[10px] text-gray-400 pl-1">{ROLE_LABELS[u.role]}</span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">{u._count.activities}</td>
                  <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">{u._count.deals}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {u.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>

                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          title="Editar"
                          onClick={() => openEdit(u)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {u.id !== currentUserId && (
                          <button
                            title={u.active ? "Desativar" : "Reativar"}
                            onClick={() => setToggleUser(u)}
                            className={`p-1.5 rounded-lg transition-colors ${u.active ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}
                          >
                            {u.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Create Sheet ── */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Novo Colaborador</SheetTitle>
          </SheetHeader>
          <form onSubmit={onCreate} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome completo"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="email@empresa.com"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha *</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <CustomRoleSelect
                value={createForm.customRoleId}
                onChange={(id) => setCreateForm((f) => ({ ...f, customRoleId: id }))}
                roleValue={createForm.role}
                onRoleChange={(r) => setCreateForm((f) => ({ ...f, role: r }))}
              />
            </div>

            {createError && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
            )}
            <SheetFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating}>{creating ? "Criando..." : "Criar colaborador"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Edit Sheet ── */}
      <Sheet open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Editar Colaborador</SheetTitle>
          </SheetHeader>
          {editUser && (
            <form onSubmit={onEdit} className="space-y-5">
              {/* Avatar preview */}
              <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {getInitials(editUser.name)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{editUser.name}</p>
                  <p className="text-xs text-gray-400">{editUser.email}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <CustomRoleSelect
                  value={editForm.customRoleId}
                  onChange={(id) => setEditForm((f) => ({ ...f, customRoleId: id }))}
                  roleValue={editForm.role}
                  onRoleChange={(r) => setEditForm((f) => ({ ...f, role: r }))}
                />
              </div>

              <div className="space-y-1.5 border-t border-gray-100 pt-4">
                <Label className="flex items-center gap-1.5 text-gray-600">
                  <KeyRound className="w-3.5 h-3.5" />
                  Nova senha
                </Label>
                <Input
                  type="password"
                  placeholder="Deixe em branco para não alterar"
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>

              {editError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</p>
              )}
              <SheetFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Toggle dialog */}
      <AlertDialog open={!!toggleUser} onOpenChange={(o) => !o && setToggleUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleUser?.active ? "Desativar colaborador?" : "Reativar colaborador?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleUser?.active
                ? `${toggleUser.name} perderá acesso ao sistema imediatamente.`
                : `${toggleUser?.name} voltará a ter acesso ao sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggle}
              className={toggleUser?.active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              {toggleUser?.active ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
