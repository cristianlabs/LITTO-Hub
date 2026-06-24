import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { TreinamentosClient } from "@/components/treinamentos/treinamentos-client"
import { hasMinRole } from "@/lib/permissions"

export default async function TreinamentosPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [courses, progressRecords] = await Promise.all([
    db.course.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { lessons: true } },
        lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, order: true, duration: true, videoUrl: true, fileUrl: true, content: true } },
      },
    }),
    db.learningProgress.findMany({
      where: { userId: session.user.id, completed: true },
      select: { courseId: true, lessonId: true },
    }),
  ])

  // progress map: "courseId:lessonId" → boolean
  const progress: Record<string, boolean> = {}
  for (const p of progressRecords) {
    if (p.lessonId) progress[`${p.courseId}:${p.lessonId}`] = true
  }

  return (
    <div>
      <Header title="Treinamentos" subtitle="Cursos, vídeoaulas e materiais de aprendizado" />
      <TreinamentosClient
        initialCourses={courses}
        progress={progress}
        canManage={hasMinRole(session.user.role, "MANAGER")}
        userId={session.user.id}
      />
    </div>
  )
}
