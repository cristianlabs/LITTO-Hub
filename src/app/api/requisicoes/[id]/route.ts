import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const req = await db.requisition.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    ...req,
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
    comments: req.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const req = await db.requisition.findUnique({ where: { id } })
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only owner or manager can delete
  if (req.userId !== session.user.id && !["OWNER", "HEAD_LEADER", "MANAGER"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.requisitionComment.deleteMany({ where: { requisitionId: id } })
  await db.requisition.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
