export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const messages = await db.message.findMany({
    where: { conversationId: id },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  })

  await db.conversation.update({
    where: { id },
    data: { unreadCount: 0 },
  })

  return NextResponse.json(messages, {
    headers: { "Cache-Control": "no-store" },
  })
}
