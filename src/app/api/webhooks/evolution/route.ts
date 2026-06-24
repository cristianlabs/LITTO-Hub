import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { normalizeJid } from "@/lib/evolution"

// Webhook verification (GET) — some validators ping this
export async function GET() {
  return NextResponse.json({ ok: true, webhook: "evolution" })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  // Evolution API v1/v2 sends events in different casings
  // Accept both: "messages.upsert" and "MESSAGES_UPSERT"
  const rawEvent: string = body.event ?? body.type ?? ""
  const event = rawEvent.toLowerCase().replace(/_/g, ".")

  const instanceName: string = body.instance ?? body.instanceName ?? body.sender ?? ""
  const data = body.data ?? body.messages ?? body

  console.log(`[webhook] ${new Date().toISOString()} event="${rawEvent}" instance="${instanceName}"`)

  try {
    if (event === "messages.upsert") {
      await handleMessageUpsert(instanceName, data)
    } else if (event === "connection.update") {
      await handleConnectionUpdate(instanceName, data)
    } else if (event === "messages.update") {
      await handleMessageUpdate(data)
    } else {
      console.log("[webhook] unhandled event:", rawEvent)
    }
  } catch (err) {
    console.error("[webhook/evolution] event:", rawEvent, "instance:", instanceName, err)
  }

  return NextResponse.json({ ok: true })
}

async function handleMessageUpsert(instanceName: string, data: unknown) {
  // Normalize: data can be an array, a single object, or { messages: [...] }
  let msgs: Record<string, unknown>[]
  if (Array.isArray(data)) {
    msgs = data
  } else if (data && typeof data === "object") {
    const d = data as Record<string, unknown>
    // Some Evolution versions nest messages inside data.messages
    if (Array.isArray(d.messages)) {
      msgs = d.messages as Record<string, unknown>[]
    } else {
      msgs = [d]
    }
  } else {
    return
  }

  const instance = await db.whatsAppInstance.findUnique({ where: { name: instanceName } })
  if (!instance) {
    console.warn("[webhook] Instance not found:", instanceName)
    return
  }

  for (const msg of msgs) {
    const key = (msg.key ?? msg) as Record<string, unknown>

    const remoteJid =
      (key.remoteJid as string) ??
      (msg.remoteJid as string) ??
      ""

    if (!remoteJid || remoteJid.includes("status@broadcast") || remoteJid.includes("broadcast")) continue

    const isFromMe = Boolean(key.fromMe ?? msg.fromMe ?? false)
    const messageId = (key.id as string) ?? (msg.id as string) ?? null

    // Extract message body from multiple possible locations
    const msgContent = (msg.message ?? msg.body ?? {}) as Record<string, unknown>
    const body: string =
      (msg.body as string) ||
      (msgContent.conversation as string) ||
      ((msgContent.extendedTextMessage as Record<string, unknown>)?.text as string) ||
      ((msgContent.imageMessage as Record<string, unknown>)?.caption as string) ||
      ((msgContent.videoMessage as Record<string, unknown>)?.caption as string) ||
      ((msgContent.documentMessage as Record<string, unknown>)?.title as string) ||
      ((msgContent.audioMessage as Record<string, unknown>) ? "[áudio]" : "") ||
      "[mídia]"

    if (!body) continue

    // Find or create conversation
    let conversation = await db.conversation.findUnique({
      where: { instanceId_remoteJid: { instanceId: instance.id, remoteJid } },
    })

    if (!conversation) {
      const phone = normalizeJid(remoteJid)
      const contact = await db.contact.findFirst({
        where: {
          OR: [
            { whatsapp: { contains: phone } },
            { phone: { contains: phone } },
          ],
        },
      })

      conversation = await db.conversation.create({
        data: {
          instanceId: instance.id,
          remoteJid,
          contactId: contact?.id ?? null,
          lastMessage: body,
          lastMessageAt: new Date(),
          unreadCount: isFromMe ? 0 : 1,
        },
      })
    } else {
      await db.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessage: body,
          lastMessageAt: new Date(),
          unreadCount: isFromMe ? conversation.unreadCount : conversation.unreadCount + 1,
        },
      })
    }

    // Dedup by remoteMessageId
    if (messageId) {
      const existing = await db.message.findUnique({ where: { remoteMessageId: messageId } })
      if (existing) continue
    }

    await db.message.create({
      data: {
        conversationId: conversation.id,
        remoteMessageId: messageId,
        direction: isFromMe ? "OUTBOUND" : "INBOUND",
        body,
        status: isFromMe ? "SENT" : "DELIVERED",
      },
    })
  }
}

async function handleConnectionUpdate(instanceName: string, data: unknown) {
  const d = (data ?? {}) as Record<string, unknown>
  const state = (d.state ?? d.status ?? "") as string
  const connected = state === "open" || state === "CONNECTED"

  await db.whatsAppInstance.updateMany({
    where: { name: instanceName },
    data: { connected },
  })
}

async function handleMessageUpdate(data: unknown) {
  const updates = Array.isArray(data) ? data : [data]

  for (const update of updates) {
    const u = update as Record<string, unknown>
    const key = (u.key ?? {}) as Record<string, unknown>
    const status = (u.status ?? u.ack ?? "") as string

    if (!key?.id || !status) continue

    const statusMap: Record<string, "DELIVERED" | "READ"> = {
      DELIVERY_ACK: "DELIVERED",
      "3": "DELIVERED",
      READ: "READ",
      PLAYED: "READ",
      "4": "READ",
    }

    const mapped = statusMap[status]
    if (mapped) {
      await db.message.updateMany({
        where: { remoteMessageId: key.id as string },
        data: { status: mapped },
      })
    }
  }
}
