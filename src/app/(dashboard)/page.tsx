import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, TrendingUp, Package, AlertTriangle, Plus, ArrowRight } from "lucide-react"
import { formatCurrency, timeAgo } from "@/lib/utils"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const [totalContacts, openDeals, totalProducts, stockAlerts, recentActivities, unreadNotifs] =
    await Promise.all([
      db.contact.count(),
      db.deal.count({ where: { status: "OPEN" } }),
      db.product.count({ where: { active: true } }),
      db.stockAlert.count({ where: { triggered: true } }),
      db.activity.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { contact: true, user: { select: { name: true } } },
      }),
      db.notification.findMany({
        where: { userId: session.user.id, read: false },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ])

  const stats = [
    { label: "Total de Contatos", value: totalContacts, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Negócios Abertos", value: openDeals, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: "Produtos Ativos", value: totalProducts, icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Alertas de Estoque", value: stockAlerts, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
  ]

  const activityTypeLabels: Record<string, string> = {
    NOTE: "Nota",
    CALL: "Ligação",
    WHATSAPP: "WhatsApp",
    EMAIL: "Email",
    MEETING: "Reunião",
    TASK: "Tarefa",
  }

  return (
    <div>
      <Header title="Dashboard" subtitle={`Bem-vindo, ${session.user.name?.split(" ")[0]}!`} />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <Card key={s.label}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{s.label}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{s.value}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${s.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Atividades Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma atividade ainda</p>
              ) : (
                <ul className="space-y-3">
                  {recentActivities.map((a) => (
                    <li key={a.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{a.title}</p>
                        <p className="text-xs text-gray-500">
                          {activityTypeLabels[a.type]} • {a.user.name} • {timeAgo(a.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {activityTypeLabels[a.type]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notificações Não Lidas</CardTitle>
            </CardHeader>
            <CardContent>
              {unreadNotifs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma notificação pendente</p>
              ) : (
                <ul className="space-y-3">
                  {unreadNotifs.map((n) => (
                    <li key={n.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500">{n.message}</p>
                        <p className="text-xs text-gray-400">{timeAgo(n.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Atalhos Rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { href: "/crm", label: "Novo Contato", icon: Users, color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
                { href: "/estoque", label: "Entrada em Estoque", icon: Package, color: "bg-green-50 text-green-700 hover:bg-green-100" },
                { href: "/requisicoes", label: "Nova Requisição", icon: Plus, color: "bg-purple-50 text-purple-700 hover:bg-purple-100" },
                { href: "/feedback", label: "Dar Feedback", icon: ArrowRight, color: "bg-orange-50 text-orange-700 hover:bg-orange-100" },
              ].map((a) => {
                const Icon = a.icon
                return (
                  <Link
                    key={a.href}
                    href={a.href}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${a.color}`}
                  >
                    <Icon className="w-4 h-4" />
                    {a.label}
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
