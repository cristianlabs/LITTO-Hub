import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { hasMinRole } from "@/lib/permissions"
import type { Role } from "@prisma/client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role as Role, "MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const limit = 30
  const skip = (page - 1) * limit

  const [items, total] = await Promise.all([
    db.flaggedMessage.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        sentBy: { select: { id: true, name: true, email: true } },
        conversation: { select: { remoteJid: true, contact: { select: { name: true } } } },
      },
    }),
    db.flaggedMessage.count(),
  ])

  return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role as Role, "MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  await db.flaggedMessage.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
