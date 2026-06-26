import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Prevent duplicate votes from the same user
  const alreadyVoted = await db.auditLog.findFirst({
    where: { userId: session.user.id, action: "VOTE", resourceId: id },
  })
  if (alreadyVoted) return NextResponse.json({ error: "Você já votou nesta requisição" }, { status: 409 })

  const [updated] = await db.$transaction([
    db.requisition.update({ where: { id }, data: { votes: { increment: 1 } } }),
    db.auditLog.create({ data: { userId: session.user.id, action: "VOTE", resource: "Requisition", resourceId: id } }),
  ])

  return NextResponse.json({ votes: updated.votes })
}
