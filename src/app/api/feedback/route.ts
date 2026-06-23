import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"

function encryptSenderId(userId: string): string {
  const key = process.env.FEEDBACK_ENCRYPTION_KEY!
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(key.padEnd(32, "0").slice(0, 32)),
    iv,
  )
  const encrypted = Buffer.concat([cipher.update(userId, "utf8"), cipher.final()])
  return iv.toString("hex") + ":" + encrypted.toString("hex")
}

const createFeedbackSchema = z.object({
  receiverId: z.string(),
  content: z.string().min(10),
  anonymous: z.boolean().optional().default(true),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const feedbacks = await db.feedback.findMany({
    where: { receiverId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      anonymous: true,
      read: true,
      createdAt: true,
      // Never expose senderEncrypted
      receiver: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(feedbacks)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createFeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { receiverId, content, anonymous } = parsed.data

  if (receiverId === session.user.id) {
    return NextResponse.json({ error: "Cannot send feedback to yourself" }, { status: 400 })
  }

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
      message: anonymous ? "Você recebeu um feedback anônimo." : "Você recebeu um feedback.",
      link: "/feedback",
    },
  })

  return NextResponse.json({ id: feedback.id }, { status: 201 })
}
