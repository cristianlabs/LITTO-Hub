import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { ModeracaoClient } from "@/components/moderacao/moderacao-client"
import { DEFAULT_PALAVRAS } from "@/lib/moderacao"
import { hasMinRole } from "@/lib/permissions"
import type { Role } from "@prisma/client"

export default async function ModeracaoPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasMinRole(session.user.role as Role, "MANAGER")) redirect("/")

  const [flagged, wordsRecord, enabledRecord] = await Promise.all([
    db.flaggedMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        sentBy: { select: { id: true, name: true, email: true } },
        conversation: { select: { remoteJid: true, contact: { select: { name: true } } } },
      },
    }),
    db.systemConfig.findUnique({ where: { key: "moderacao_palavras" } }),
    db.systemConfig.findUnique({ where: { key: "moderacao_enabled" } }),
  ])

  const total = await db.flaggedMessage.count()
  const pages = Math.ceil(total / 30)

  const customWords: string[] = wordsRecord ? JSON.parse(wordsRecord.value) : []
  const enabled: boolean = enabledRecord ? JSON.parse(enabledRecord.value) : true

  const items = flagged.map((f) => ({
    ...f,
    notifiedAt: f.notifiedAt?.toISOString() ?? null,
    createdAt: f.createdAt.toISOString(),
  }))

  return (
    <div>
      <Header title="Moderação" subtitle="Monitoramento de mensagens ofensivas no WhatsApp" />
      <ModeracaoClient
        initialItems={items}
        initialTotal={total}
        initialPages={pages}
        customWords={customWords}
        defaultWords={DEFAULT_PALAVRAS}
        enabled={enabled}
      />
    </div>
  )
}
