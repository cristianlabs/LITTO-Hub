"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Contact {
  id: string
  name: string
}

interface Deal {
  id: string
  title: string
  value?: { toString(): string } | null
  expectedClose?: Date | null
  contact?: Contact | null
  pipelineId: string
}

interface Pipeline {
  id: string
  name: string
  color: string
  order: number
  deals: Deal[]
}

interface Props {
  pipelines: Pipeline[]
  contacts: Contact[]
}

const schema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  value: z.string().optional(),
  contactId: z.string().optional(),
  expectedClose: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function DealCard({
  deal,
  pipelines,
  onMoved,
}: {
  deal: Deal
  pipelines: Pipeline[]
  onMoved: () => void
}) {
  const [dragging, setDragging] = useState(false)

  async function moveTo(pipelineId: string) {
    if (pipelineId === deal.pipelineId) return
    await fetch("/api/crm/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deal.id, pipelineId }),
    })
    onMoved()
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("dealId", deal.id)
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      className={`bg-white rounded-xl border border-gray-200 p-3.5 cursor-grab active:cursor-grabbing hover:shadow-sm transition-all select-none ${dragging ? "opacity-50 ring-2 ring-blue-400" : ""}`}
    >
      <h4 className="font-medium text-gray-900 text-sm leading-tight mb-2">{deal.title}</h4>
      {deal.contact && (
        <p className="text-xs text-gray-500 mb-2">{deal.contact.name}</p>
      )}
      <div className="flex items-center justify-between">
        {deal.value ? (
          <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            {formatCurrency(deal.value.toString())}
          </span>
        ) : (
          <span />
        )}
        {deal.expectedClose && (
          <span className="text-xs text-gray-400">{formatDate(deal.expectedClose)}</span>
        )}
      </div>
    </div>
  )
}

function AddDealForm({
  pipelineId,
  contacts,
  onSaved,
  onCancel,
}: {
  pipelineId: string
  contacts: Contact[]
  onSaved: () => void
  onCancel: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    await fetch("/api/crm/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        value: data.value ? parseFloat(data.value) : undefined,
        contactId: data.contactId || undefined,
        expectedClose: data.expectedClose || undefined,
        pipelineId,
      }),
    })
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-blue-200 p-3 space-y-2">
      <Input {...register("title")} placeholder="Título do negócio..." className="h-8 text-sm" autoFocus />
      <Input {...register("value")} type="number" placeholder="Valor (R$)" className="h-8 text-sm" />
      <select
        {...register("contactId")}
        className="w-full h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">Contato (opcional)</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <Input {...register("expectedClose")} type="date" className="h-8 text-sm" />
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" className="flex-1 h-8 text-xs" disabled={isSubmitting}>
          {isSubmitting ? "..." : "Adicionar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onCancel}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </form>
  )
}

export function KanbanBoard({ pipelines: initial, contacts }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pipelines, setPipelines] = useState(initial)
  const [addingTo, setAddingTo] = useState<string | null>(null)

  function refresh() {
    startTransition(() => router.refresh())
  }

  function handleDrop(e: React.DragEvent, targetPipelineId: string) {
    e.preventDefault()
    const dealId = e.dataTransfer.getData("dealId")
    if (!dealId) return

    // Optimistic update
    setPipelines((prev) => {
      const deal = prev.flatMap((p) => p.deals).find((d) => d.id === dealId)
      if (!deal || deal.pipelineId === targetPipelineId) return prev
      return prev.map((p) => ({
        ...p,
        deals:
          p.id === deal.pipelineId
            ? p.deals.filter((d) => d.id !== dealId)
            : p.id === targetPipelineId
              ? [...p.deals, { ...deal, pipelineId: targetPipelineId }]
              : p.deals,
      }))
    })

    fetch("/api/crm/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dealId, pipelineId: targetPipelineId }),
    }).then(() => refresh())
  }

  const totalValue = pipelines
    .flatMap((p) => p.deals)
    .reduce((sum, d) => sum + (d.value ? parseFloat(d.value.toString()) : 0), 0)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Summary bar */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-6 text-sm">
        <span className="text-gray-500">
          <span className="font-semibold text-gray-900">{pipelines.flatMap((p) => p.deals).length}</span> negócios em aberto
        </span>
        <span className="text-gray-500">
          Total: <span className="font-semibold text-green-700">{formatCurrency(totalValue)}</span>
        </span>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max items-start">
          {pipelines.map((pipeline) => (
            <div
              key={pipeline.id}
              className="w-72 flex flex-col bg-gray-50 rounded-2xl border border-gray-200"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, pipeline.id)}
            >
              {/* Column header */}
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pipeline.color }} />
                  <span className="font-medium text-gray-900 text-sm">{pipeline.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
                    {pipeline.deals.length}
                  </span>
                </div>
                <button
                  onClick={() => setAddingTo(addingTo === pipeline.id ? null : pipeline.id)}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Column value */}
              {pipeline.deals.length > 0 && (
                <div className="px-4 py-1.5 text-xs text-gray-400 border-b border-gray-100">
                  {formatCurrency(
                    pipeline.deals.reduce(
                      (sum, d) => sum + (d.value ? parseFloat(d.value.toString()) : 0),
                      0,
                    ),
                  )}
                </div>
              )}

              {/* Cards */}
              <div className="flex flex-col gap-2 p-3 min-h-[120px]">
                {addingTo === pipeline.id && (
                  <AddDealForm
                    pipelineId={pipeline.id}
                    contacts={contacts}
                    onSaved={() => {
                      setAddingTo(null)
                      refresh()
                    }}
                    onCancel={() => setAddingTo(null)}
                  />
                )}

                {pipeline.deals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    pipelines={pipelines}
                    onMoved={refresh}
                  />
                ))}

                {pipeline.deals.length === 0 && addingTo !== pipeline.id && (
                  <div className="flex items-center justify-center h-16 border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-xs text-gray-400">Arraste negócios aqui</p>
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
