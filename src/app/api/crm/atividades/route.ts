import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  type: z.enum(["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING", "TASK"]),
  title: z.string().min(1),
  content: z.string().optional(),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  dueDate: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get("contactId")
  const dealId = searchParams.get("dealId")

  const activities = await db.activity.findMany({
    where: {
      ...(contactId ? { contactId } : {}),
      ...(dealId ? { dealId } : {}),
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(activities)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const activity = await db.activity.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    },
    include: { user: { select: { id: true, name: true } } },
  })

  return NextResponse.json(activity, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, completed } = await req.json()
  const activity = await db.activity.update({
    where: { id },
    data: { completed },
    include: { user: { select: { id: true, name: true } } },
  })

  return NextResponse.json(activity)
}
