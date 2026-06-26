export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""
  const status = searchParams.get("status") ?? ""

  const conversations = await db.conversation.findMany({
    where: {
      ...(status ? { status: status as "OPEN" | "RESOLVED" | "WAITING" } : {}),
      ...(q
        ? {
            OR: [
              { contact: { name: { contains: q, mode: "insensitive" } } },
              { remoteJid: { contains: q } },
              { lastMessage: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      contact: { select: { id: true, name: true } },
      instance: { select: { id: true, name: true, connected: true } },
      assignee: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { lastMessageAt: "desc" },
  })

  return NextResponse.json(conversations)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, status, assignedTo } = await req.json()

  const conv = await db.conversation.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(assignedTo !== undefined ? { assignedTo } : {}),
      ...(status === "RESOLVED" ? { unreadCount: 0 } : {}),
    },
    include: {
      contact: { select: { id: true, name: true } },
      instance: { select: { id: true, name: true, connected: true } },
    },
  })

  return NextResponse.json(conv)
}
