import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate, getInitials } from "@/lib/utils"
import Link from "next/link"
import { Phone, MessageCircle, GitBranch, Plus } from "lucide-react"
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

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { q = "", status = "" } = await searchParams

  const contacts = await db.contact.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        status ? { status: status as ContactStatus } : {},
      ],
    },
    include: { company: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <Header title="CRM" subtitle="Gestão de contatos e relacionamentos" />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {["", "LEAD", "PROSPECT", "ACTIVE", "INACTIVE", "LOST"].map((s) => (
              <Link
                key={s}
                href={`/crm?${q ? `q=${q}&` : ""}status=${s}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  status === s
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s === "" ? "Todos" : STATUS_LABELS[s as ContactStatus]}
              </Link>
            ))}
          </div>
          <div className="flex gap-2">
            <Link href="/crm/pipeline">
              <Button variant="outline" size="sm">
                <GitBranch className="w-4 h-4 mr-1.5" />
                Pipeline
              </Button>
            </Link>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Contato
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Contato</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Empresa</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Telefone / Email</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Criado em</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    Nenhum contato encontrado
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {getInitials(c.name)}
                        </div>
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.company?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{c.phone ?? "—"}</div>
                      <div className="text-gray-400 text-xs">{c.email ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}
                      >
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {c.whatsapp && (
                          <a
                            href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Ligar"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
