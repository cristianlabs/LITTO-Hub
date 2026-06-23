import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus } from "lucide-react"

export default async function PipelinePage() {
  const session = await auth()
  if (!session) redirect("/login")

  const pipelines = await db.pipeline.findMany({
    orderBy: { order: "asc" },
    include: {
      deals: {
        where: { status: "OPEN" },
        include: { contact: true },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  return (
    <div className="flex flex-col h-full">
      <Header title="Pipeline" subtitle="Gestão de negócios por etapa" />

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 min-w-max h-full">
          {pipelines.map((pipeline) => (
            <div key={pipeline.id} className="w-72 flex flex-col">
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: pipeline.color }}
                  />
                  <h3 className="font-medium text-gray-900 text-sm">{pipeline.name}</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {pipeline.deals.length}
                  </span>
                </div>
                <button className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 flex-1">
                {pipeline.deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow cursor-pointer"
                  >
                    <h4 className="font-medium text-gray-900 text-sm mb-2">{deal.title}</h4>
                    {deal.contact && (
                      <p className="text-xs text-gray-500 mb-2">{deal.contact.name}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      {deal.value ? (
                        <span className="text-sm font-semibold text-green-700">
                          {formatCurrency(deal.value.toString())}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sem valor</span>
                      )}
                      {deal.expectedClose && (
                        <span className="text-xs text-gray-400">
                          {formatDate(deal.expectedClose)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Empty state */}
                {pipeline.deals.length === 0 && (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                    <p className="text-xs text-gray-400">Nenhum negócio</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
