import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Video, FileText, Plus } from "lucide-react"
import type { LmsCategory } from "@prisma/client"

const CATEGORIES: { key: LmsCategory; label: string; icon: typeof BookOpen }[] = [
  { key: "PRODUCT_MANUAL", label: "Manuais de Produto", icon: FileText },
  { key: "SALES_TRAINING", label: "Videoaulas de Vendas", icon: Video },
  { key: "COMPANY_RULES", label: "Regras da Empresa", icon: BookOpen },
]

export default async function TreinamentosPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const courses = await db.course.findMany({
    where: { published: true },
    orderBy: { order: "asc" },
    include: { _count: { select: { lessons: true } } },
  })

  const byCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c.key, courses.filter((co) => co.category === c.key)]),
  )

  return (
    <div>
      <Header title="Treinamentos" subtitle="Cursos e materiais de aprendizado" />

      <div className="p-6 space-y-6">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const catCourses = byCategory[cat.key] ?? []
          return (
            <Card key={cat.key}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="w-4 h-4 text-gray-500" />
                  {cat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {catCourses.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center">
                    <Icon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Nenhum conteúdo ainda</p>
                    <button className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:underline mx-auto">
                      <Plus className="w-3.5 h-3.5" /> Adicionar conteúdo
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {catCourses.map((c) => (
                      <div
                        key={c.id}
                        className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer"
                      >
                        <h4 className="font-medium text-sm text-gray-900 mb-1">{c.title}</h4>
                        {c.description && (
                          <p className="text-xs text-gray-500 line-clamp-2">{c.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {c._count.lessons} aula{c._count.lessons !== 1 ? "s" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
