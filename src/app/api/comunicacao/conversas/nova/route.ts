import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { sendTextMessage, toJid } from "@/lib/evolution"

const schema = z.object({
  instanceId: z.string(),
  phone: z.string().min(8),
  message: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const instance = await db.whatsAppInstance.findUnique({ where: { id: parsed.data.instanceId } })
  if (!instance) return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })
  if (!instance.connected) return NextResponse.json({ error: "Instância desconectada" }, { status: 400 })

  const remoteJid = toJid(parsed.data.phone)

  // Send via Evolution API
  let remoteMessageId: string | undefined
  try {
    const result = await sendTextMessage(instance.name, remoteJid, parsed.data.message)
    remoteMessageId = result?.key?.id
  } catch (err) {
    console.error("[nova conversa] Evolution error:", err)
    return NextResponse.json({ error: "Falha ao enviar mensagem pela Evolution API" }, { status: 502 })
  }

  // Find or create conversation
  let conversation = await db.conversation.findUnique({
    where: { instanceId_remoteJid: { instanceId: instance.id, remoteJid } },
  })

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        instanceId: instance.id,
        remoteJid,
        status: "OPEN",
        lastMessage: parsed.data.message,
        lastMessageAt: new Date(),
      },
    })
  }

  await db.message.create({
    data: {
      conversationId: conversation.id,
      remoteMessageId: remoteMessageId ?? null,
      direction: "OUTBOUND",
      body: parsed.data.message,
      sentBy: session.user.id,
      status: "SENT",
    },
  })

  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessage: parsed.data.message, lastMessageAt: new Date() },
  })

  return NextResponse.json({ conversationId: conversation.id }, { status: 201 })
}
