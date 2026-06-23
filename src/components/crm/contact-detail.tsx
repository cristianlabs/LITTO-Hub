"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ContactFormSheet } from "./contact-form-sheet"
import { ActivityFeed } from "./activity-feed"
import { formatCurrency, formatDate, getInitials } from "@/lib/utils"
import { ArrowLeft, Phone, MessageCircle, Mail, Pencil } from "lucide-react"
import type { ContactStatus, DealStatus, ActivityType } from "@prisma/client"

const STATUS_LABELS: Record<ContactStatus, string> = {
  LEAD: "Lead", PROSPECT: "Prospect", ACTIVE: "Ativo", INACTIVE: "Inativo", LOST: "Perdido",
}
const STATUS_COLORS: Record<ContactStatus, string> = {
  LEAD: "bg-blue-100 text-blue-700",
  PROSPECT: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-600",
  LOST: "bg-red-100 text-red-700",
}
const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  OPEN: "Aberto", WON: "Ganho", LOST: "Perdido", FROZEN: "Congelado",
}
const DEAL_STATUS_COLORS: Record<DealStatus, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  WON: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
  FROZEN: "bg-gray-100 text-gray-500",
}

interface Activity {
  id: string
  type: ActivityType
  title: string
  content?: string | null
  completed: boolean
  createdAt: Date
  user: { id: string; name: string | null }
}

interface Deal {
  id: string
  title: string
  value?: { toString(): string } | null
  status: DealStatus
  expectedClose?: Date | null
  pipeline: { name: string; color: string }
}

interface Contact {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  cpf?: string | null
  status: ContactStatus
  notes?: string | null
  createdAt: Date
  company?: { id: string; name: string } | null
  deals: Deal[]
  activities: Activity[]
}

export function ContactDetail({ contact }: { contact: Contact }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [sheetOpen, setSheetOpen] = useState(false)

  const onSaved = useCallback(() => {
    startTransition(() => router.refresh())
  }, [router])

  const totalDealsValue = contact.deals
    .filter((d) => d.status === "OPEN" || d.status === "WON")
    .reduce((sum, d) => sum + (d.value ? parseFloat(d.value.toString()) : 0), 0)

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/crm">
          <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — profile */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold mb-3">
                  {getInitials(contact.name)}
                </div>
                <h2 className="font-semibold text-gray-900 text-lg">{contact.name}</h2>
                {contact.company && (
                  <p className="text-sm text-gray-500">{contact.company.name}</p>
                )}
                <span className={`mt-2 inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[contact.status]}`}>
                  {STATUS_LABELS[contact.status]}
                </span>
              </div>

              <div className="space-y-2">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
                    <Mail className="w-4 h-4 text-gray-400" /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
                    <Phone className="w-4 h-4 text-gray-400" /> {contact.phone}
                  </a>
                )}
                {contact.whatsapp && (
                  <a
                    href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-600"
                  >
                    <MessageCircle className="w-4 h-4 text-gray-400" /> {contact.whatsapp}
                  </a>
                )}
              </div>

              {contact.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Observações</p>
                  <p className="text-sm text-gray-600">{contact.notes}</p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
                Criado em {formatDate(contact.createdAt)}
              </div>

              <Button size="sm" variant="outline" className="w-full mt-4" onClick={() => setSheetOpen(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar contato
              </Button>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{contact.deals.length}</p>
                  <p className="text-xs text-gray-500">Negócios</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(totalDealsValue)}</p>
                  <p className="text-xs text-gray-500">Valor total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right — deals + activities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Deals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Negócios</CardTitle>
            </CardHeader>
            <CardContent>
              {contact.deals.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum negócio vinculado</p>
              ) : (
                <div className="space-y-2">
                  {contact.deals.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.pipeline.color }} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{d.title}</p>
                          <p className="text-xs text-gray-400">{d.pipeline.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {d.value && (
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(d.value.toString())}
                          </p>
                        )}
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${DEAL_STATUS_COLORS[d.status]}`}>
                          {DEAL_STATUS_LABELS[d.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activities */}
          <Card>
            <CardContent className="p-5">
              <ActivityFeed
                contactId={contact.id}
                activities={contact.activities.map((a) => ({
                  ...a,
                  createdAt: a.createdAt.toISOString(),
                  user: { ...a.user, name: a.user.name },
                }))}
                onRefresh={() => startTransition(() => router.refresh())}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <ContactFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        contact={contact}
        onSaved={onSaved}
      />
    </div>
  )
}
