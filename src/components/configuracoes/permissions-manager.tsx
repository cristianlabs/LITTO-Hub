"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ALL_MODULES, ROLES_ORDERED, DEFAULT_PERMISSIONS } from "@/lib/module-permissions"
import { ROLE_LABELS } from "@/lib/permissions"
import { Check, X, RotateCcw, Save, ShieldCheck, Info } from "lucide-react"
import type { Role } from "@prisma/client"

interface Props {
  initialPermissions: Record<string, Role[]>
  isOwner: boolean
}

export function PermissionsManager({ initialPermissions, isOwner }: Props) {
  const [permissions, setPermissions] = useState<Record<string, Role[]>>(initialPermissions)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggle(moduleKey: string, role: Role) {
    if (!isOwner) return
    setPermissions((prev) => {
      const current = prev[moduleKey] ?? []
      const has = current.includes(role)
      // OWNER always has all permissions (enforce)
      if (role === "OWNER") return prev
      return {
        ...prev,
        [moduleKey]: has ? current.filter((r) => r !== role) : [...current, role],
      }
    })
  }

  function setRow(moduleKey: string, roles: Role[]) {
    if (!isOwner) return
    setPermissions((prev) => ({ ...prev, [moduleKey]: roles }))
  }

  async function save() {
    setSaving(true)
    try {
      await fetch("/api/configuracoes/permissoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissions),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setPermissions(DEFAULT_PERMISSIONS as Record<string, Role[]>)
  }

  const ROLE_COLORS: Record<Role, string> = {
    OWNER: "text-purple-700 bg-purple-50 border-purple-200",
    HEAD_LEADER: "text-blue-700 bg-blue-50 border-blue-200",
    MANAGER: "text-green-700 bg-green-50 border-green-200",
    SELLER: "text-yellow-700 bg-yellow-50 border-yellow-200",
    EMPLOYEE: "text-gray-700 bg-gray-50 border-gray-200",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Matriz de Permissões</p>
            <p className="text-sm text-gray-500">
              Defina quais cargos têm acesso a cada módulo do sistema.
            </p>
          </div>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restaurar padrão
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-green-600" /> Salvo!
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? "Salvando..." : "Salvar"}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {!isOwner && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <Info className="w-4 h-4 flex-shrink-0" />
          Apenas o Proprietário pode editar as permissões.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide w-44">
                  Módulo
                </th>
                {ROLES_ORDERED.map((role) => (
                  <th key={role} className="px-3 py-3 text-center min-w-[100px]">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[role]}`}>
                      {ROLE_LABELS[role]}
                    </span>
                  </th>
                ))}
                {isOwner && (
                  <th className="px-3 py-3 text-xs text-gray-400 font-medium text-center">Ações rápidas</th>
                )}
              </tr>
            </thead>
            <tbody>
              {ALL_MODULES.map((mod, idx) => {
                const allowed = permissions[mod.key] ?? []
                const allGranted = ROLES_ORDERED.every((r) => allowed.includes(r))
                const noneGranted = ROLES_ORDERED.filter((r) => r !== "OWNER").every((r) => !allowed.includes(r))

                return (
                  <tr
                    key={mod.key}
                    className={`border-b border-gray-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">{mod.label}</td>
                    {ROLES_ORDERED.map((role) => {
                      const hasAccess = allowed.includes(role)
                      const isFixed = role === "OWNER"
                      return (
                        <td key={role} className="px-3 py-3 text-center">
                          <button
                            onClick={() => toggle(mod.key, role)}
                            disabled={isFixed || !isOwner}
                            title={isFixed ? "Proprietário sempre tem acesso" : undefined}
                            className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-all ${
                              isFixed
                                ? "bg-purple-100 text-purple-600 cursor-default"
                                : hasAccess
                                ? "bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer"
                                : "bg-gray-100 text-gray-300 hover:bg-gray-200 cursor-pointer"
                            } ${!isOwner && !isFixed ? "cursor-default" : ""}`}
                          >
                            {hasAccess ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      )
                    })}
                    {isOwner && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setRow(mod.key, [...ROLES_ORDERED])}
                            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                              allGranted
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            Todos
                          </button>
                          <button
                            onClick={() => setRow(mod.key, ["OWNER"])}
                            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                              noneGranted
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            Nenhum
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        O Proprietário sempre tem acesso a todos os módulos. Alterações no sidebar são aplicadas no próximo login.
      </p>
    </div>
  )
}
