import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toJid } from "@/lib/evolution"

const schema = z.object({
  phone: z.string().min(1),
  contactId: z.string().optional(),
})

// POST — busca conversa existente para esse número ou cria uma nova
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { phone, contactId } = parsed.data
  const remoteJid = toJid(phone)

  // Pega a primeira instância conectada
  const instance = await db.whatsAppInstance.findFirst({
    where: { connected: true },
    orderBy: { createdAt: "asc" },
  })
  if (!instance) return NextResponse.json({ error: "Nenhuma instância do WhatsApp conectada" }, { status: 400 })

  // Busca conversa existente por número — tenta JID exato, senão busca por número parcial
  const phoneDigits = phone.replace(/[^0-9]/g, "")
  let conversation = await db.conversation.findFirst({
    where: { instanceId: instance.id, remoteJid },
  }) ?? await db.conversation.findFirst({
    where: { instanceId: instance.id, remoteJid: { contains: phoneDigits } },
    orderBy: { lastMessageAt: "desc" },
  })

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        instanceId: instance.id,
        remoteJid,
        contactId: contactId ?? null,
        lastMessage: "",
        lastMessageAt: new Date(),
        unreadCount: 0,
        status: "OPEN",
      },
    })
  }

  return NextResponse.json({ conversationId: conversation.id })
}
