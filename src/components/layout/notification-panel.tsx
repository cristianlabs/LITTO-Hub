"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, Package, MessageCircle, CheckCheck, AlertTriangle, Info, X } from "lucide-react"
import { timeAgo } from "@/lib/utils"
import Link from "next/link"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string | null
  read: boolean
  createdAt: string
}

const TYPE_ICON: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
  STOCK_ZERO:  { icon: AlertTriangle, bg: "bg-red-100",    color: "text-red-600" },
  STOCK_MIN:   { icon: AlertTriangle, bg: "bg-yellow-100", color: "text-yellow-600" },
  STOCK_MAX:   { icon: Package,       bg: "bg-blue-100",   color: "text-blue-600" },
  NEW_MESSAGE: { icon: MessageCircle, bg: "bg-green-100",  color: "text-green-600" },
  SYSTEM:      { icon: Info,          bg: "bg-gray-100",   color: "text-gray-500" },
}

function getIcon(type: string) {
  return TYPE_ICON[type] ?? TYPE_ICON.SYSTEM
}

export function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  async function load() {
    const [nRes, cRes] = await Promise.all([
      fetch("/api/notificacoes"),
      fetch("/api/notificacoes/unread-count"),
    ])
    if (nRes.ok) setNotifications(await nRes.json())
    if (cRes.ok) setUnread((await cRes.json()).count ?? 0)
  }

  // Poll unread count every 30s
  useEffect(() => {
    load()
    const t = setInterval(() => {
      fetch("/api/notificacoes/unread-count")
        .then((r) => r.json())
        .then((d) => setUnread(d.count ?? 0))
        .catch(() => {})
    }, 30_000)
    return () => clearInterval(t)
  }, [])

  // Load full list when opening
  useEffect(() => {
    if (open) load()
  }, [open])

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  async function markRead(id: string) {
    await fetch("/api/notificacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnread((u) => Math.max(0, u - 1))
  }

  async function markAllRead() {
    await fetch("/api/notificacoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notificações</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como lidas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map((n) => {
                const { icon: Icon, bg, color } = getIcon(n.type)
                const content = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                      n.read ? "bg-white hover:bg-gray-50" : "bg-blue-50/40 hover:bg-blue-50"
                    }`}
                    onClick={() => !n.read && markRead(n.id)}
                  >
                    <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-sm ${n.read ? "text-gray-700" : "font-semibold text-gray-900"}`}>
                          {n.title}
                        </p>
                        {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                )

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => { markRead(n.id); setOpen(false) }}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
