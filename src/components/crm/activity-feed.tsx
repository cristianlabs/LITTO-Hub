"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { timeAgo } from "@/lib/utils"
import {
  StickyNote,
  Phone,
  MessageCircle,
  Mail,
  Users,
  CheckSquare,
  Check,
} from "lucide-react"

const ACTIVITY_ICONS = {
  NOTE: StickyNote,
  CALL: Phone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  MEETING: Users,
  TASK: CheckSquare,
}

const ACTIVITY_COLORS = {
  NOTE: "bg-yellow-100 text-yellow-700",
  CALL: "bg-blue-100 text-blue-700",
  WHATSAPP: "bg-green-100 text-green-700",
  EMAIL: "bg-purple-100 text-purple-700",
  MEETING: "bg-pink-100 text-pink-700",
  TASK: "bg-orange-100 text-orange-700",
}

const ACTIVITY_LABELS = {
  NOTE: "Nota",
  CALL: "Ligação",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  MEETING: "Reunião",
  TASK: "Tarefa",
}

type ActivityType = keyof typeof ACTIVITY_ICONS

interface Activity {
  id: string
  type: ActivityType
  title: string
  content?: string | null
  completed: boolean
  createdAt: string
  user: { id: string; name: string | null }
}

interface Props {
  contactId?: string
  dealId?: string
  activities: Activity[]
  onRefresh: () => void
}

const schema = z.object({
  type: z.enum(["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING", "TASK"]),
  title: z.string().min(1, "Título obrigatório"),
  content: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function ActivityFeed({ contactId, dealId, activities, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "NOTE" },
  })

  async function onSubmit(data: FormData) {
    await fetch("/api/crm/atividades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, contactId, dealId }),
    })
    reset()
    setShowForm(false)
    onRefresh()
  }

  async function toggleComplete(id: string, completed: boolean) {
    await fetch("/api/crm/atividades", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed: !completed }),
    })
    onRefresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 text-sm">Atividades</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          + Registrar
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="mb-4 bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((t) => {
              const Icon = ACTIVITY_ICONS[t]
              return (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" value={t} {...register("type")} className="sr-only peer" />
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-gray-200 peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 transition-colors">
                    <Icon className="w-3 h-3" />
                    {ACTIVITY_LABELS[t]}
                  </span>
                </label>
              )
            })}
          </div>
          <input
            {...register("title")}
            placeholder="Título da atividade..."
            className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Textarea {...register("content")} placeholder="Detalhes (opcional)..." rows={2} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhuma atividade registrada</p>
        ) : (
          activities.map((a) => {
            const Icon = ACTIVITY_ICONS[a.type]
            return (
              <div key={a.id} className={`flex gap-3 ${a.completed ? "opacity-60" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${ACTIVITY_COLORS[a.type]}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium text-gray-900 ${a.completed ? "line-through" : ""}`}>
                      {a.title}
                    </p>
                    {a.type === "TASK" && (
                      <button
                        onClick={() => toggleComplete(a.id, a.completed)}
                        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          a.completed
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-gray-300 hover:border-green-400"
                        }`}
                      >
                        {a.completed && <Check className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                  {a.content && <p className="text-xs text-gray-500 mt-0.5">{a.content}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {a.user.name} · {timeAgo(a.createdAt)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
