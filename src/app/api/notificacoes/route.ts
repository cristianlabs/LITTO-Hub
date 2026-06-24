import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  })

  return NextResponse.json(notifications)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { id } = body

  if (id) {
    // Mark single as read
    await db.notification.updateMany({
      where: { id, userId: session.user.id },
      data: { read: true },
    })
  } else {
    // Mark all as read
    await db.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    })
  }

  return NextResponse.json({ ok: true })
}
