import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const users = await db.user.findMany({
    where: { active: true, id: { not: session.user.id } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(users)
}
