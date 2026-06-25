export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { FeedbackClient } from "@/components/feedback/feedback-client"

export default async function FeedbackPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const isPrivileged = session.user.role === "OWNER" || session.user.role === "HEAD_LEADER"

  const users = await db.user.findMany({
    where: { active: true, id: { not: session.user.id } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="flex flex-col h-full">
      <Header title="Feedback" subtitle="Envie e receba feedbacks anônimos" />
      <FeedbackClient
        users={users}
        currentUserId={session.user.id}
        isPrivileged={isPrivileged}
      />
    </div>
  )
}
