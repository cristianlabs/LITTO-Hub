import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const updated = await db.requisition.update({
    where: { id },
    data: { votes: { increment: 1 } },
  })

  return NextResponse.json({ votes: updated.votes })
}
