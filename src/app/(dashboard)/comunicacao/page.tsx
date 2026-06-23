import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { ComunicacaoClient } from "@/components/comunicacao/comunicacao-client"

export default async function ComunicacaoPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [instances, conversations] = await Promise.all([
    db.whatsAppInstance.findMany({ orderBy: { createdAt: "asc" } }),
    db.conversation.findMany({
      include: {
        contact: { select: { id: true, name: true } },
        instance: { select: { id: true, name: true, connected: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    }),
  ])

  return (
    <div className="flex flex-col h-full">
      <Header title="Comunicação" subtitle="WhatsApp integrado via Evolution API" />
      <ComunicacaoClient
        initialInstances={instances}
        initialConversations={conversations}
      />
    </div>
  )
}
