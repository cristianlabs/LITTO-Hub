import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { formatCurrency, timeAgo } from "@/lib/utils"
import {
  Users, TrendingUp, Package, MessageCircle,
  AlertTriangle, CheckCircle2, XCircle, ArrowUpRight,
  ArrowRight, Clock,
} from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    contactCount,
    deals,
    products,
    stockAlerts,
    unreadMessages,
    recentActivities,
    topPipeline,
  ] = await Promise.all([
    db.contact.count({ where: { status: "ACTIVE" } }),
    db.deal.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { status: true, value: true },
    }),
    db.product.findMany({
      where: { active: true },
      select: { currentStock: true, minStock: true, name: true },
      take: 100,
    }),
    db.stockAlert.count({ where: { triggered: true } }),
    db.conversation.aggregate({ _sum: { unreadCount: true } }),
    db.activity.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, type: true, createdAt: true,
        contact: { select: { name: true } },
        user: { select: { name: true } },
      },
    }),
    db.pipeline.findMany({
      select: {
        name: true, color: true,
        _count: { select: { deals: true } },
        deals: { where: { status: "OPEN" }, select: { value: true } },
      },
      orderBy: { order: "asc" },
    }),
  ])

  const openDeals = deals.filter((d) => d.status === "OPEN")
  const wonDeals = deals.filter((d) => d.status === "WON")
  const lostDeals = deals.filter((d) => d.status === "LOST")
  const totalRevenue = wonDeals.reduce((s, d) => s + Number(d.value ?? 0), 0)
  const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0)
  const convRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0

  const lowStockProducts = products.filter(
    (p) => p.currentStock <= p.minStock,
  ).slice(0, 4)

  const TYPE_ICON: Record<string, string> = {
    NOTE: "📝", CALL: "📞", WHATSAPP: "💬", EMAIL: "✉️", MEETING: "🤝", TASK: "✅",
  }

  const kpis = [
    {
      label: "Contatos ativos",
      value: contactCount,
      sub: "total cadastrado",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/clientes",
    },
    {
      label: "Receita (30 dias)",
      value: formatCurrency(totalRevenue),
      sub: `${wonDeals.length} negócios ganhos`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
      href: "/vendas",
    },
    {
      label: "Pipeline aberto",
      value: formatCurrency(pipelineValue),
      sub: `${openDeals.length} em andamento`,
      icon: ArrowRight,
      color: "text-purple-600",
      bg: "bg-purple-50",
      href: "/crm",
    },
    {
      label: "Mensagens não lidas",
      value: unreadMessages._sum.unreadCount ?? 0,
      sub: "conversas ativas",
      icon: MessageCircle,
      color: "text-sky-600",
      bg: "bg-sky-50",
      href: "/comunicacao",
    },
  ]

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle={`Bom dia, ${session.user.name?.split(" ")[0]}! Aqui está o resumo dos últimos 30 dias.`}
      />

      <div className="p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => {
            const Icon = k.icon
            return (
              <Link key={k.href} href={k.href}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1.5">{k.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${k.color}`} />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                  <span>Ver detalhes</span>
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </Link>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Funis do CRM */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Funis CRM</h3>
              <Link href="/crm" className="text-xs text-blue-600 hover:underline">Ver kanban</Link>
            </div>
            {topPipeline.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhum funil criado</p>
            ) : (
              <div className="space-y-3">
                {topPipeline.map((p) => {
                  const val = p.deals.reduce((s, d) => s + Number(d.value ?? 0), 0)
                  const max = Math.max(...topPipeline.map((x) =>
                    x.deals.reduce((s, d) => s + Number(d.value ?? 0), 0)), 1)
                  const pct = Math.round((val / max) * 100)
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5 font-medium text-gray-700">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </span>
                        <span className="text-gray-500">{p.deals.length} · {formatCurrency(val)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: p.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Desempenho vendas */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Vendas (30 dias)</h3>
              <Link href="/vendas" className="text-xs text-blue-600 hover:underline">Detalhes</Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Ganhos</p>
                  <p className="font-bold text-gray-900">{wonDeals.length} negócios</p>
                </div>
                <p className="text-sm font-semibold text-green-600">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Perdidos</p>
                  <p className="font-bold text-gray-900">{lostDeals.length} negócios</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Em aberto</p>
                  <p className="font-bold text-gray-900">{openDeals.length} negócios</p>
                </div>
                <p className="text-sm font-semibold text-blue-600">{formatCurrency(pipelineValue)}</p>
              </div>
              <div className="mt-2 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Taxa de conversão</span>
                  <span className="font-semibold text-gray-700">{convRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${convRate}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Estoque crítico */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Estoque Crítico</h3>
              <div className="flex items-center gap-2">
                {stockAlerts > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    {stockAlerts} alertas
                  </span>
                )}
                <Link href="/estoque" className="text-xs text-blue-600 hover:underline">Ver tudo</Link>
              </div>
            </div>
            {lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Package className="w-8 h-8 text-gray-200" />
                <p className="text-sm text-gray-400">Estoque dentro do normal</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {lowStockProducts.map((p) => {
                  const pct = p.minStock ? Math.min(Math.round((p.currentStock / p.minStock) * 100), 100) : 100
                  const critical = p.currentStock === 0
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 truncate max-w-[140px]">{p.name}</span>
                        <span className={`font-semibold ${critical ? "text-red-600" : "text-orange-600"}`}>
                          {critical ? "Zerado" : `${p.currentStock} un.`}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div className={`h-full rounded-full ${critical ? "bg-red-500" : "bg-orange-400"}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Atividades recentes */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-sm">Atividades Recentes</h3>
            <Link href="/crm" className="text-xs text-blue-600 hover:underline">Ver CRM</Link>
          </div>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma atividade registrada</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentActivities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <span className="text-lg leading-none mt-0.5">{TYPE_ICON[a.type] ?? "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {a.contact?.name && <>{a.contact.name} · </>}{a.user.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas estoque */}
        {stockAlerts > 0 && (
          <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
            <p className="text-sm text-orange-800 flex-1">
              <strong>{stockAlerts} {stockAlerts === 1 ? "alerta de estoque ativo" : "alertas de estoque ativos"}</strong>
              {" — alguns produtos estão abaixo do mínimo ou zerados."}
            </p>
            <Link href="/estoque" className="text-xs font-semibold text-orange-700 hover:text-orange-900 flex items-center gap-1">
              Ver estoque <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
