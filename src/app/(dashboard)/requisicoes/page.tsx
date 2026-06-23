import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, timeAgo } from "@/lib/utils"
import { ShoppingCart, Cpu, Building2, ThumbsUp } from "lucide-react"
import type { RequisitionCategory, RequisitionStatus, Priority } from "@prisma/client"

const CATEGORY_LABELS: Record<RequisitionCategory, string> = {
  PURCHASE: "Compras",
  SYSTEM_IMPROVEMENT: "Melhoria de Sistema",
  INFRASTRUCTURE: "Infraestrutura",
}

const CATEGORY_ICONS: Record<RequisitionCategory, typeof ShoppingCart> = {
  PURCHASE: ShoppingCart,
  SYSTEM_IMPROVEMENT: Cpu,
  INFRASTRUCTURE: Building2,
}

const STATUS_LABELS: Record<RequisitionStatus, string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberto",
  IN_REVIEW: "Em revisão",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  DONE: "Concluído",
}

const STATUS_COLORS: Record<RequisitionStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  OPEN: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  DONE: "bg-purple-100 text-purple-700",
}

const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: "text-gray-500",
  MEDIUM: "text-blue-500",
  HIGH: "text-orange-500",
  CRITICAL: "text-red-600 font-semibold",
}

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
}

const CATEGORIES: RequisitionCategory[] = ["PURCHASE", "SYSTEM_IMPROVEMENT", "INFRASTRUCTURE"]

export default async function RequisicoesPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [requisitions, counts] = await Promise.all([
    db.requisition.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } }, _count: { select: { comments: true } } },
    }),
    Promise.all(
      CATEGORIES.map((cat) =>
        db.requisition.count({ where: { category: cat } }).then((c) => ({ cat, count: c })),
      ),
    ),
  ])

  const countMap = Object.fromEntries(counts.map((c) => [c.cat, c.count]))

  return (
    <div>
      <Header title="Requisições" subtitle="Solicitações internas por categoria" />

      <div className="p-6 space-y-6">
        {/* Category cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat]
            return (
              <Card key={cat}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{CATEGORY_LABELS[cat]}</p>
                      <p className="text-2xl font-bold text-gray-900">{countMap[cat] ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Título</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Categoria</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Prioridade</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Autor</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Votos</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Criado</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    Nenhuma requisição ainda
                  </td>
                </tr>
              ) : (
                requisitions.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.title}</p>
                      {r.description && (
                        <p className="text-xs text-gray-400 truncate max-w-xs">{r.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{CATEGORY_LABELS[r.category]}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${PRIORITY_COLORS[r.priority]}`}>
                        {PRIORITY_LABELS[r.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.user.name}</td>
                    <td className="px-4 py-3">
                      <button className="flex items-center gap-1 text-gray-500 hover:text-blue-600">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span className="text-xs">{r.votes}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{timeAgo(r.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
