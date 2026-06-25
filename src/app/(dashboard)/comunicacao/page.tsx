export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { ComunicacaoClient } from "@/components/comunicacao/comunicacao-client"

export default async function ComunicacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ conversa?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { conversa } = await searchParams

  const convInclude = {
    contact: { select: { id: true, name: true } },
    instance: { select: { id: true, name: true, connected: true } },
    assignee: { select: { id: true, name: true } },
  }

  const [instances, conversations] = await Promise.all([
    db.whatsAppInstance.findMany({ orderBy: { createdAt: "asc" } }),
    db.conversation.findMany({
      include: convInclude,
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    }),
  ])

  // If coming from CRM with a specific conversation, ensure it's in the list
  if (conversa && !conversations.find((c) => c.id === conversa)) {
    const extra = await db.conversation.findUnique({ where: { id: conversa }, include: convInclude })
    if (extra) conversations.unshift(extra)
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Comunicação" subtitle="WhatsApp integrado via Evolution API" />
      <ComunicacaoClient
        initialInstances={instances}
        initialConversations={conversations}
        initialConversaId={conversa}
      />
    </div>
  )
}
