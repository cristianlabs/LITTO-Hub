import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { sendTextMessage, sendMediaMessage } from "@/lib/evolution"
import { verificarEFlagarMensagem } from "@/lib/moderacao"

const mediaTypes = ["image", "video", "document", "audio"] as const

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    conversationId: z.string(),
    body: z.string().min(1),
  }),
  z.object({
    type: z.enum(mediaTypes),
    conversationId: z.string(),
    mediaBase64: z.string().min(1),
    caption: z.string().optional(),
    fileName: z.string().optional(),
    mimetype: z.string().optional(),
  }),
])

function parseEvolutionError(err: unknown): { notOnWhatsApp: boolean; message: string } {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('"exists":false') || msg.includes("exists")) {
    return { notOnWhatsApp: true, message: "Número não encontrado no WhatsApp" }
  }
  return { notOnWhatsApp: false, message: msg }
}

const DEFAULT_BODY: Record<string, string> = {
  image: "[imagem]", video: "[vídeo]", document: "[documento]", audio: "[áudio]",
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const raw = await req.json()
  if (!raw.type) raw.type = "text"

  const parsed = schema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const conversation = await db.conversation.findUnique({
    where: { id: parsed.data.conversationId },
    include: { instance: true },
  })
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })

  const instanceName = conversation.instance.name
  const remoteJid = conversation.remoteJid

  let remoteMessageId: string | undefined
  let msgBody: string
  let msgType: string = parsed.data.type
  let mediaUrl: string | null = null
  let sendError: string | null = null

  try {
    if (parsed.data.type === "text") {
      msgBody = parsed.data.body
      const result = await sendTextMessage(instanceName, remoteJid, msgBody)
      remoteMessageId = result?.key?.id
    } else {
      const { type, mediaBase64, caption, fileName, mimetype } = parsed.data as {
        type: string; mediaBase64: string; caption?: string; fileName?: string; mimetype?: string
      }
      msgBody = caption ?? fileName ?? DEFAULT_BODY[type] ?? `[${type}]`
      mediaUrl = mediaBase64
      const result = await sendMediaMessage(
        instanceName, remoteJid,
        type as "image" | "video" | "document" | "audio",
        mediaBase64, caption, fileName, mimetype
      )
      remoteMessageId = result?.key?.id
    }
  } catch (err) {
    const e = parseEvolutionError(err)
    console.error("[mensagens POST] Evolution error:", e.message)
    sendError = e.message
    if (parsed.data.type === "text") {
      msgBody = parsed.data.body
    } else {
      const d = parsed.data as { caption?: string; fileName?: string; mediaBase64: string }
      msgBody = d.caption ?? d.fileName ?? DEFAULT_BODY[parsed.data.type] ?? `[${parsed.data.type}]`
      mediaUrl = d.mediaBase64
    }
  }

  const message = await db.message.create({
    data: {
      conversationId: conversation.id,
      remoteMessageId: remoteMessageId ?? null,
      direction: "OUTBOUND",
      body: msgBody!,
      type: msgType,
      mediaUrl,
      sentBy: session.user.id,
      status: sendError ? "FAILED" : "SENT",
    },
    include: { sender: { select: { id: true, name: true } } },
  })

  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessage: msgBody!, lastMessageAt: new Date() },
  })

  // Moderation check for outbound messages from UI (fire-and-forget)
  if (!sendError && parsed.data.type === "text") {
    verificarEFlagarMensagem({
      messageId: message.id,
      conversationId: conversation.id,
      body: msgBody!,
      direction: "OUTBOUND",
      sentByUserId: session.user.id,
      remoteJid,
      instanceName,
    }).catch((err) => console.error("[moderacao mensagens]", err))
  }

  return NextResponse.json({ ...message, sendError }, { status: 201 })
}
