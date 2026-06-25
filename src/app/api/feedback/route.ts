import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"

function getKey() {
  const raw = process.env.FEEDBACK_ENCRYPTION_KEY ?? "default-key-32-chars-padded-here"
  return Buffer.from(raw.padEnd(32, "0").slice(0, 32))
}

function encryptSenderId(userId: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-cbc", getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(userId, "utf8"), cipher.final()])
  return iv.toString("hex") + ":" + encrypted.toString("hex")
}

function decryptSenderId(enc: string): string | null {
  try {
    const [ivHex, encHex] = enc.split(":")
    const iv = Buffer.from(ivHex, "hex")
    const decipher = crypto.createDecipheriv("aes-256-cbc", getKey(), iv)
    const dec = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()])
    return dec.toString("utf8")
  } catch {
    return null
  }
}

const isPrivileged = (role: string) => role === "OWNER" || role === "HEAD_LEADER"

const createSchema = z.object({
  receiverId: z.string(),
  content: z.string().min(10),
  anonymous: z.boolean().optional().default(true),
})

const patchSchema = z.object({
  id: z.string(),
  read: z.boolean(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const view = new URL(req.url).searchParams.get("view")

  // Privileged: see all feedbacks with decrypted sender
  if (view === "all" && isPrivileged(session.user.role)) {
    const feedbacks = await db.feedback.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        receiver: { select: { id: true, name: true } },
        sender: { select: { id: true, name: true } },
      },
    })

    const senderIds = feedbacks
      .map((f) => f.senderEncrypted ? decryptSenderId(f.senderEncrypted) : null)
      .filter((id): id is string => id !== null)

    const senderUsers = await db.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, name: true },
    })
    const senderMap = new Map(senderUsers.map((u) => [u.id, u.name]))

    const result = feedbacks.map((f) => {
      const decryptedId = f.senderEncrypted ? decryptSenderId(f.senderEncrypted) : null
      const senderName = decryptedId ? (senderMap.get(decryptedId) ?? null) : null
      return {
        id: f.id,
        content: f.content,
        anonymous: f.anonymous,
        read: f.read,
        createdAt: f.createdAt.toISOString(),
        receiver: f.receiver,
        senderName,
      }
    })

    return NextResponse.json(result)
  }

  // Regular users: own received feedbacks, sender always hidden
  const feedbacks = await db.feedback.findMany({
    where: { receiverId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, anonymous: true, read: true, createdAt: true },
  })

  return NextResponse.json(feedbacks.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { receiverId, content, anonymous } = parsed.data

  if (receiverId === session.user.id)
    return NextResponse.json({ error: "Não é possível enviar feedback para si mesmo" }, { status: 400 })

  const senderEncrypted = encryptSenderId(session.user.id)

  const feedback = await db.feedback.create({
    data: {
      senderId: anonymous ? null : session.user.id,
      receiverId,
      content,
      senderEncrypted,
      anonymous,
    },
  })

  await db.notification.create({
    data: {
      userId: receiverId,
      type: "FEEDBACK_RECEIVED",
      title: "Novo feedback recebido",
      message: "Você recebeu um novo feedback.",
      link: "/feedback",
    },
  })

  return NextResponse.json({ id: feedback.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const feedback = await db.feedback.findUnique({ where: { id: parsed.data.id } })
  if (!feedback) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

  if (feedback.receiverId !== session.user.id && !isPrivileged(session.user.role))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  await db.feedback.update({ where: { id: parsed.data.id }, data: { read: parsed.data.read } })
  return NextResponse.json({ ok: true })
}
