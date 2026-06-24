import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hasMinRole } from "@/lib/permissions"

const courseSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.enum(["PRODUCT_MANUAL", "SALES_TRAINING", "COMPANY_RULES", "OTHER"]).optional(),
  published: z.boolean().optional(),
  order: z.number().optional(),
})

const lessonSchema = z.object({
  action: z.literal("add_lesson"),
  title: z.string().min(1),
  content: z.string().optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
  fileUrl: z.string().optional(),
  duration: z.number().optional(),
})

const progressSchema = z.object({
  action: z.literal("progress"),
  lessonId: z.string(),
  completed: z.boolean(),
})

const deleteLessonSchema = z.object({
  action: z.literal("delete_lesson"),
  lessonId: z.string(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  if (body.action === "progress") {
    const parsed = progressSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    await db.learningProgress.upsert({
      where: { userId_courseId_lessonId: { userId: session.user.id, courseId: id, lessonId: parsed.data.lessonId } },
      create: {
        userId: session.user.id, courseId: id, lessonId: parsed.data.lessonId,
        completed: parsed.data.completed, completedAt: parsed.data.completed ? new Date() : null,
      },
      update: {
        completed: parsed.data.completed, completedAt: parsed.data.completed ? new Date() : null,
      },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "add_lesson") {
    if (!hasMinRole(session.user.role, "MANAGER")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    const parsed = lessonSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const lastLesson = await db.lesson.findFirst({ where: { courseId: id }, orderBy: { order: "desc" } })
    const lesson = await db.lesson.create({
      data: {
        courseId: id, title: parsed.data.title, content: parsed.data.content,
        videoUrl: parsed.data.videoUrl || null, fileUrl: parsed.data.fileUrl || null,
        duration: parsed.data.duration, order: (lastLesson?.order ?? -1) + 1,
      },
    })
    return NextResponse.json(lesson, { status: 201 })
  }

  if (body.action === "delete_lesson") {
    if (!hasMinRole(session.user.role, "MANAGER")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    const parsed = deleteLessonSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    await db.lesson.delete({ where: { id: parsed.data.lessonId } })
    return NextResponse.json({ ok: true })
  }

  if (!hasMinRole(session.user.role, "MANAGER")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  const parsed = courseSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const course = await db.course.update({ where: { id }, data: parsed.data })
  return NextResponse.json(course)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "MANAGER")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  const { id } = await params
  await db.course.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
