import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { normalizeJid } from "@/lib/evolution"

// Evolution API sends webhook events here
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const { event, instance: instanceName, data } = body

  try {
    if (event === "messages.upsert") {
      await handleMessageUpsert(instanceName, data)
    } else if (event === "connection.update") {
      await handleConnectionUpdate(instanceName, data)
    } else if (event === "messages.update") {
      await handleMessageUpdate(data)
    }
  } catch (err) {
    console.error("[webhook/evolution]", err)
  }

  return NextResponse.json({ ok: true })
}

async function handleMessageUpsert(instanceName: string, data: Record<string, unknown>) {
  const msgs = Array.isArray(data) ? data : [data]

  const instance = await db.whatsAppInstance.findUnique({ where: { name: instanceName } })
  if (!instance) return

  for (const msg of msgs) {
    const key = msg.key as Record<string, unknown>
    if (!key) continue

    const remoteJid = key.remoteJid as string
    if (!remoteJid || remoteJid.includes("status@broadcast")) continue

    const isFromMe = key.fromMe as boolean
    const messageId = key.id as string
    const msgContent = msg.message as Record<string, unknown>
    const body =
      (msgContent?.conversation as string) ||
      (msgContent?.extendedTextMessage as Record<string, unknown>)?.text as string ||
      (msgContent?.imageMessage as Record<string, unknown>)?.caption as string ||
      "[mídia]"

    // Find or create conversation
    let conversation = await db.conversation.findUnique({
      where: { instanceId_remoteJid: { instanceId: instance.id, remoteJid } },
    })

    if (!conversation) {
      // Try to match a contact by phone
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

    // Avoid duplicate messages
    const existing = messageId
      ? await db.message.findUnique({ where: { remoteMessageId: messageId } })
      : null

    if (!existing) {
      await db.message.create({
        data: {
          conversationId: conversation.id,
          remoteMessageId: messageId ?? null,
          direction: isFromMe ? "OUTBOUND" : "INBOUND",
          body,
          status: isFromMe ? "SENT" : "DELIVERED",
        },
      })
    }
  }
}

async function handleConnectionUpdate(instanceName: string, data: Record<string, unknown>) {
  const state = data?.state as string
  const connected = state === "open"

  await db.whatsAppInstance.updateMany({
    where: { name: instanceName },
    data: { connected },
  })
}

async function handleMessageUpdate(data: unknown) {
  const updates = Array.isArray(data) ? data : [data]

  for (const update of updates) {
    const u = update as Record<string, unknown>
    const key = u.key as Record<string, unknown>
    const status = u.status as string

    if (!key?.id || !status) continue

    const statusMap: Record<string, string> = {
      DELIVERY_ACK: "DELIVERED",
      READ: "READ",
      PLAYED: "READ",
    }

    const mapped = statusMap[status]
    if (mapped) {
      await db.message.updateMany({
        where: { remoteMessageId: key.id as string },
        data: { status: mapped as "DELIVERED" | "READ" },
      })
    }
  }
}
