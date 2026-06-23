"use client"

import { Bell, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetch("/api/notificacoes/unread-count")
      .then((r) => r.json())
      .then((d) => setUnreadCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar..." className="pl-9 w-56 h-9 text-sm" />
        </div>
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
