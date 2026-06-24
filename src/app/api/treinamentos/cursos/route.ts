import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hasMinRole } from "@/lib/permissions"

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(["PRODUCT_MANUAL", "SALES_TRAINING", "COMPANY_RULES", "OTHER"]),
  thumbnail: z.string().optional(),
  published: z.boolean().optional(),
  order: z.number().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const courses = await db.course.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { lessons: true } },
      lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, order: true, duration: true, videoUrl: true, fileUrl: true, content: true } },
    },
  })

  return NextResponse.json(courses)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "MANAGER")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const course = await db.course.create({ data: parsed.data })
  return NextResponse.json(course, { status: 201 })
}
