"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ContactFormSheet } from "./contact-form-sheet"
import { formatDate, getInitials } from "@/lib/utils"
import { GitBranch, Phone, MessageCircle, Search, Pencil, Trash2, Eye, CalendarDays } from "lucide-react"
import type { ContactStatus } from "@prisma/client"

const STATUS_LABELS: Record<ContactStatus, string> = {
  LEAD: "Lead",
  PROSPECT: "Prospect",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  LOST: "Perdido",
}

const STATUS_COLORS: Record<ContactStatus, string> = {
  LEAD: "bg-blue-100 text-blue-700",
  PROSPECT: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-600",
  LOST: "bg-red-100 text-red-700",
}

interface Contact {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  cpf?: string | null
  cnpj?: string | null
  razaoSocial?: string | null
  status: ContactStatus
  notes?: string | null
  createdAt: Date
  company?: { id: string; name: string } | null
}

interface Props {
  contacts: Contact[]
  total: number
  countMap: Record<string, number>
  currentQ: string
  currentStatus: string
}

export function ContactsTable({ contacts, total, countMap, currentQ, currentStatus }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editContact, setEditContact] = useState<Contact | undefined>()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(currentQ)

  function applyFilter(status: string) {
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    if (status) params.set("status", status)
    router.push(`${pathname}?${params.toString()}`)
  }

  function applySearch(q: string) {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (currentStatus) params.set("status", currentStatus)
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleNew() {
    setEditContact(undefined)
    setSheetOpen(true)
  }

  function handleEdit(c: Contact) {
    setEditContact(c)
    setSheetOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este contato?")) return
    await fetch(`/api/crm/contatos/${id}`, { method: "DELETE" })
    startTransition(() => router.refresh())
  }

  const onSaved = useCallback(() => {
    startTransition(() => router.refresh())
  }, [router])

  const statuses: Array<{ key: string; label: string }> = [
    { key: "", label: `Todos (${total})` },
    { key: "LEAD", label: `Lead (${countMap.LEAD ?? 0})` },
    { key: "PROSPECT", label: `Prospect (${countMap.PROSPECT ?? 0})` },
    { key: "ACTIVE", label: `Ativo (${countMap.ACTIVE ?? 0})` },
    { key: "INACTIVE", label: `Inativo (${countMap.INACTIVE ?? 0})` },
    { key: "LOST", label: `Perdido (${countMap.LOST ?? 0})` },
  ]

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              className="pl-8 h-9 w-56 text-sm"
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch(search)}
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => applySearch(search)}>
            Buscar
          </Button>
        </div>
        <div className="flex gap-2">
          <Link href="/crm/pipeline">
            <Button variant="outline" size="sm">
              <GitBranch className="w-4 h-4 mr-1.5" />
              Pipeline
            </Button>
          </Link>
          <Link href="/crm/calendario">
            <Button variant="outline" size="sm">
              <CalendarDays className="w-4 h-4 mr-1.5" />
              Agenda
            </Button>
          </Link>
          <Button size="sm" onClick={handleNew}>
            + Novo Contato
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s.key}
            onClick={() => applyFilter(s.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentStatus === s.key
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Contato</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Empresa</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Contato</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Criado</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-400">
                  <p className="font-medium">Nenhum contato encontrado</p>
                  <p className="text-xs mt-1">Tente outro filtro ou crie um novo contato.</p>
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {getInitials(c.name)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{c.name}</p>
                        {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{c.company?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-gray-500 text-xs hover:text-blue-600">
                          {c.phone}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <Link href={`/crm/${c.id}`}>
                        <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver detalhes">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                      {c.whatsapp && (
                        <a
                          href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ligar">
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleEdit(c)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ContactFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        contact={editContact}
        onSaved={onSaved}
      />
    </div>
  )
}
