import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { sendTextMessage } from "@/lib/evolution"

const schema = z.object({
  conversationId: z.string(),
  body: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const conversation = await db.conversation.findUnique({
    where: { id: parsed.data.conversationId },
    include: { instance: true },
  })

  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })

  // Send via Evolution API
  let remoteMessageId: string | undefined
  try {
    const result = await sendTextMessage(
      conversation.instance.name,
      conversation.remoteJid,
      parsed.data.body,
    )
    remoteMessageId = result?.key?.id
  } catch (err) {
    console.error("[mensagens POST] Evolution error:", err)
    // Continue — save message locally even if send fails (offline/dev mode)
  }

  const message = await db.message.create({
    data: {
      conversationId: conversation.id,
      remoteMessageId: remoteMessageId ?? null,
      direction: "OUTBOUND",
      body: parsed.data.body,
      sentBy: session.user.id,
      status: "SENT",
    },
    include: { sender: { select: { id: true, name: true } } },
  })

  // Update conversation last message
  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessage: parsed.data.body, lastMessageAt: new Date() },
  })

  return NextResponse.json(message, { status: 201 })
}
