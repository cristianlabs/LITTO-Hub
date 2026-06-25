"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, X, TrendingDown, TrendingUp, Briefcase, CheckSquare, ShoppingCart } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { CalendarEvent, CalendarEventType } from "@/app/api/crm/calendario/route"

// ─── Config de tipos ──────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<CalendarEventType, {
  label: string
  color: string
  bg: string
  dot: string
  icon: typeof Briefcase
}> = {
  BILL:           { label: "Conta a Pagar",    color: "text-red-700",    bg: "bg-red-50 border-red-200",    dot: "bg-red-500",    icon: TrendingDown  },
  RECEIVABLE:     { label: "Conta a Receber",  color: "text-green-700",  bg: "bg-green-50 border-green-200",dot: "bg-green-500",  icon: TrendingUp    },
  DEAL:           { label: "Venda",            color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",  dot: "bg-blue-500",   icon: Briefcase     },
  TASK:           { label: "Tarefa",           color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200",dot:"bg-yellow-500", icon: CheckSquare   },
  PURCHASE_ORDER: { label: "Pedido de Compra", color: "text-orange-700", bg: "bg-orange-50 border-orange-200",dot:"bg-orange-500", icon: ShoppingCart  },
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente", PAID: "Pago", OVERDUE: "Vencida",
  OPEN: "Em aberto", WON: "Ganho", LOST: "Perdido",
  RECEIVED: "Recebido", APPROVED: "Aprovado",
}

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const WEEK_DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  isPrivileged: boolean
}

export function CalendarioCrm({ isPrivileged }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // Visible type filters
  const [activeTypes, setActiveTypes] = useState<Set<CalendarEventType>>(
    new Set(Object.keys(TYPE_CONFIG) as CalendarEventType[])
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/calendario?year=${year}&month=${month}`)
      if (res.ok) setEvents(await res.json())
    } finally { setLoading(false) }
  }, [year, month])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  function toggleType(type: CalendarEventType) {
    setActiveTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  )
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const visibleEvents = events.filter(e => activeTypes.has(e.type))

  function eventsForDay(day: number) {
    return visibleEvents.filter(e => {
      const d = new Date(e.date)
      return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day
    })
  }

  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : []
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 w-44 text-center">
            {MONTHS[month - 1]} {year}
          </h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setSelectedDay(today.getDate()) }}
            className="ml-2 px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Hoje
          </button>
          {loading && <span className="text-xs text-gray-400 animate-pulse">Carregando...</span>}
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.entries(TYPE_CONFIG) as [CalendarEventType, typeof TYPE_CONFIG[CalendarEventType]][])
            .filter(([type]) => isPrivileged || (type !== "BILL" && type !== "RECEIVABLE"))
            .map(([type, cfg]) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  activeTypes.has(type)
                    ? `${cfg.bg} ${cfg.color}`
                    : "bg-white border-gray-200 text-gray-400"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${activeTypes.has(type) ? cfg.dot : "bg-gray-300"}`} />
                {cfg.label}
              </button>
            ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Week day headers */}
          <div className="grid grid-cols-7 mb-2">
            {WEEK_DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />
              const dayEvents = eventsForDay(day)
              const isSelected = selectedDay === day
              const isTd = isToday(day)

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`min-h-[80px] rounded-xl border p-1.5 text-left transition-all hover:shadow-sm flex flex-col ${
                    isSelected
                      ? "border-blue-400 bg-blue-50 shadow-md"
                      : isTd
                      ? "border-blue-200 bg-blue-50/40"
                      : "border-gray-100 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isTd ? "bg-blue-600 text-white" : "text-gray-700"
                  }`}>
                    {day}
                  </span>
                  <div className="space-y-0.5 flex-1">
                    {dayEvents.slice(0, 3).map(e => {
                      const cfg = TYPE_CONFIG[e.type]
                      return (
                        <div
                          key={e.id}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate border ${cfg.bg} ${cfg.color}`}
                          onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e); setSelectedDay(day) }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className="truncate">{e.title}</span>
                        </div>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 3} mais</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Side panel — selected day or event */}
        {(selectedDay || selectedEvent) && (
          <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">
                {selectedEvent
                  ? "Detalhes"
                  : `${String(selectedDay).padStart(2, "0")} de ${MONTHS[month - 1]}`}
              </h3>
              <button
                onClick={() => { setSelectedEvent(null); setSelectedDay(null) }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedEvent ? (
              // Event detail
              <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
            ) : (
              // Day events list
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Nenhum evento neste dia</p>
                ) : selectedDayEvents.map(e => {
                  const cfg = TYPE_CONFIG[e.type]
                  const Icon = cfg.icon
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors hover:shadow-sm ${cfg.bg}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.dot} bg-opacity-20`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${cfg.color} mb-0.5`}>{cfg.label}</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                        {e.value != null && (
                          <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(e.value)}</p>
                        )}
                        {e.ownerName && (
                          <p className="text-xs text-gray-400 mt-0.5">{e.ownerName}</p>
                        )}
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 mt-1 shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Event Detail ─────────────────────────────────────────────────────────────

function EventDetail({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const cfg = TYPE_CONFIG[event.type]
  const Icon = cfg.icon
  const date = new Date(event.date)
  const dateStr = date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })

  const rows: { label: string; value: string }[] = [
    { label: "Data", value: dateStr },
    ...(event.status ? [{ label: "Status", value: STATUS_LABEL[event.status] ?? event.status }] : []),
    ...(event.value != null ? [{ label: "Valor", value: formatCurrency(event.value) }] : []),
    ...(event.ownerName ? [{ label: "Responsável", value: event.ownerName }] : []),
  ]

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4">
      {/* Type badge */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border w-fit ${cfg.bg}`}>
        <Icon className={`w-4 h-4 ${cfg.color}`} />
        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* Title */}
      <h4 className="font-semibold text-gray-900 leading-snug">{event.title}</h4>

      {/* Details table */}
      <div className="space-y-2.5">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-start gap-2">
            <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-gray-800 font-medium">{value}</span>
          </div>
        ))}
      </div>

      {/* Navigate to source */}
      {event.link && (
        <Link
          href={event.link}
          onClick={onClose}
          className={`mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium border transition-colors ${cfg.bg} ${cfg.color} hover:opacity-80`}
        >
          <Icon className="w-4 h-4" />
          Ver em {cfg.label}
        </Link>
      )}
    </div>
  )
}
