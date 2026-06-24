import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  inApp: z.boolean(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const config = await db.stockAlertConfig.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json(config ?? { email: true, push: true, inApp: true })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const config = await db.stockAlertConfig.upsert({
    where: { userId: session.user.id },
    update: parsed.data,
    create: { userId: session.user.id, ...parsed.data },
  })

  return NextResponse.json(config)
}
