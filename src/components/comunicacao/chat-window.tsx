"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Send, Check, CheckCheck, UserCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getInitials, timeAgo } from "@/lib/utils"
import Link from "next/link"

interface Message {
  id: string
  direction: "INBOUND" | "OUTBOUND"
  body: string
  status: "SENT" | "DELIVERED" | "READ" | "FAILED"
  createdAt: string
  sender?: { id: string; name: string | null } | null
}

interface Conversation {
  id: string
  remoteJid: string
  status: "OPEN" | "RESOLVED" | "WAITING"
  contact?: { id: string; name: string } | null
  instance: { id: string; name: string; connected: boolean }
}

interface Props {
  conversation: Conversation
  onStatusChange: (id: string, status: "OPEN" | "RESOLVED" | "WAITING") => void
}

const STATUS_ICON = {
  SENT: <Check className="w-3 h-3 text-gray-400" />,
  DELIVERED: <CheckCheck className="w-3 h-3 text-gray-400" />,
  READ: <CheckCheck className="w-3 h-3 text-blue-400" />,
  FAILED: <span className="text-red-400 text-xs">!</span>,
}

export function ChatWindow({ conversation, onStatusChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/comunicacao/conversas/${conversation.id}/mensagens`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data)
    }
  }, [conversation.id])

  useEffect(() => {
    setLoading(true)
    fetchMessages().finally(() => setLoading(false))

    // Poll for new messages every 3 seconds
    intervalRef.current = setInterval(fetchMessages, 3000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage() {
    if (!text.trim() || sending) return
    const body = text.trim()
    setText("")
    setSending(true)

    // Optimistic
    const temp: Message = {
      id: `temp-${Date.now()}`,
      direction: "OUTBOUND",
      body,
      status: "SENT",
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, temp])

    try {
      await fetch("/api/comunicacao/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id, body }),
      })
      await fetchMessages()
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id))
      setText(body)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const name = conversation.contact?.name ?? conversation.remoteJid.replace(/@.*$/, "")

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-semibold">
            {getInitials(name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 text-sm">{name}</p>
              {conversation.contact && (
                <Link href={`/crm/${conversation.contact.id}`} className="text-gray-400 hover:text-blue-600">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {conversation.remoteJid.replace(/@.*$/, "")} · {conversation.instance.name}
              {!conversation.instance.connected && (
                <span className="ml-1 text-red-400">· desconectado</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conversation.status !== "RESOLVED" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => onStatusChange(conversation.id, "RESOLVED")}
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Resolver
            </Button>
          )}
          {conversation.status === "RESOLVED" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => onStatusChange(conversation.id, "OPEN")}
            >
              Reabrir
            </Button>
          )}
          {conversation.contact && (
            <Link href={`/crm/${conversation.contact.id}`}>
              <Button size="sm" variant="ghost" className="h-8 text-xs">
                <UserCircle className="w-3.5 h-3.5 mr-1" /> Ver no CRM
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#efeae2]">
        {loading && messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">Carregando...</div>
        )}
        {messages.map((msg, i) => {
          const isOut = msg.direction === "OUTBOUND"
          const prevMsg = messages[i - 1]
          const showTime =
            !prevMsg ||
            new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000

          return (
            <div key={msg.id}>
              {showTime && (
                <div className="text-center my-3">
                  <span className="text-xs text-gray-500 bg-white/70 px-3 py-1 rounded-full">
                    {timeAgo(msg.createdAt)}
                  </span>
                </div>
              )}
              <div className={`flex ${isOut ? "justify-end" : "justify-start"} mb-1`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    isOut
                      ? "bg-[#dcf8c6] text-gray-900 rounded-tr-sm"
                      : "bg-white text-gray-900 rounded-tl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end" : "justify-start"}`}>
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isOut && STATUS_ICON[msg.status]}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white">
        {conversation.status === "RESOLVED" ? (
          <div className="text-center text-sm text-gray-400 py-2">
            Conversa resolvida.{" "}
            <button
              onClick={() => onStatusChange(conversation.id, "OPEN")}
              className="text-blue-600 hover:underline"
            >
              Reabrir para responder
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem... (Enter para enviar)"
              rows={1}
              className="resize-none min-h-[40px] max-h-32 text-sm"
            />
            <Button
              onClick={sendMessage}
              disabled={!text.trim() || sending}
              size="sm"
              className="h-10 w-10 p-0 flex-shrink-0 bg-green-500 hover:bg-green-600"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
