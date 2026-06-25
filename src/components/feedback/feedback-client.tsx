"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Shield, MessageSquare, Send, Inbox, Eye, EyeOff,
  Users, CheckCircle2, Circle, ChevronRight, Lock,
} from "lucide-react"
import { formatDate } from "@/lib/utils"

interface User { id: string; name: string | null; role: string }

interface MyFeedback {
  id: string
  content: string
  anonymous: boolean
  read: boolean
  createdAt: string
}

interface AllFeedback {
  id: string
  content: string
  anonymous: boolean
  read: boolean
  createdAt: string
  receiver: { id: string; name: string | null }
  senderName: string | null
}

interface Props {
  users: User[]
  currentUserId: string
  isPrivileged: boolean
}

const schema = z.object({
  receiverId: z.string().min(1, "Selecione um destinatário"),
  content: z.string().min(10, "Mínimo de 10 caracteres"),
})
type FormData = z.infer<typeof schema>

type Tab = "send" | "received" | "all"

export function FeedbackClient({ users, currentUserId, isPrivileged }: Props) {
  const [tab, setTab] = useState<Tab>("received")
  const [myFeedbacks, setMyFeedbacks] = useState<MyFeedback[]>([])
  const [allFeedbacks, setAllFeedbacks] = useState<AllFeedback[]>([])
  const [loadingMy, setLoadingMy] = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [filterReceiver, setFilterReceiver] = useState("")

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
  })

  const loadMy = useCallback(async () => {
    setLoadingMy(true)
    try {
      const res = await fetch("/api/feedback")
      if (res.ok) setMyFeedbacks(await res.json())
    } finally { setLoadingMy(false) }
  }, [])

  const loadAll = useCallback(async () => {
    if (!isPrivileged) return
    setLoadingAll(true)
    try {
      const res = await fetch("/api/feedback?view=all")
      if (res.ok) setAllFeedbacks(await res.json())
    } finally { setLoadingAll(false) }
  }, [isPrivileged])

  useEffect(() => { loadMy() }, [loadMy])
  useEffect(() => { if (tab === "all") loadAll() }, [tab, loadAll])

  async function onSubmit(data: FormData) {
    setSending(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, anonymous: true }),
      })
      if (res.ok) {
        setSuccess(true)
        reset()
        setTimeout(() => setSuccess(false), 4000)
        if (tab === "all") loadAll()
      }
    } finally { setSending(false) }
  }

  async function markRead(id: string, read: boolean) {
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read }),
    })
    setMyFeedbacks((prev) => prev.map((f) => f.id === id ? { ...f, read } : f))
    setAllFeedbacks((prev) => prev.map((f) => f.id === id ? { ...f, read } : f))
  }

  const unreadCount = myFeedbacks.filter((f) => !f.read).length

  const filteredAll = filterReceiver
    ? allFeedbacks.filter((f) => f.receiver.id === filterReceiver)
    : allFeedbacks

  const tabs: { key: Tab; label: string; icon: typeof Send }[] = [
    { key: "received", label: "Recebidos", icon: Inbox },
    { key: "send", label: "Enviar", icon: Send },
    ...(isPrivileged ? [{ key: "all" as Tab, label: "Todos (Gestão)", icon: Users }] : []),
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {key === "received" && unreadCount > 0 && (
                <span className="w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── RECEIVED ── */}
        {tab === "received" && (
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
              <Lock className="w-5 h-5 text-gray-400 shrink-0" />
              <p className="text-sm text-gray-500">
                Você vê apenas os feedbacks enviados para você. O remetente nunca é revelado.
              </p>
            </div>

            {loadingMy ? (
              <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
            ) : myFeedbacks.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
                <Inbox className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">Nenhum feedback ainda</p>
                <p className="text-xs text-gray-400 mt-1">Quando colegas enviarem feedbacks para você, aparecerão aqui.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myFeedbacks.map((f) => (
                  <div key={f.id}
                    className={`bg-white border rounded-xl p-4 transition-colors ${f.read ? "border-gray-200" : "border-blue-300 bg-blue-50/30"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${f.read ? "bg-gray-100" : "bg-blue-100"}`}>
                        <MessageSquare className={`w-4 h-4 ${f.read ? "text-gray-400" : "text-blue-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs text-gray-400">{formatDate(f.createdAt)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Anônimo</span>
                            {!f.read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                          </div>
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed">{f.content}</p>
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={() => markRead(f.id, !f.read)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {f.read
                          ? <><Circle className="w-3.5 h-3.5" /> Marcar como não lido</>
                          : <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Marcar como lido</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SEND ── */}
        {tab === "send" && (
          <div className="max-w-2xl space-y-5">
            <div className="flex items-start gap-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-blue-900 text-sm">Sua identidade está protegida</p>
                <p className="text-blue-700 text-sm mt-1">
                  O feedback é enviado de forma anônima. Sua identidade é criptografada com AES-256
                  e apenas a liderança pode acessá-la em casos previstos na política da empresa.
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Para quem é este feedback?</Label>
                  <select
                    {...register("receiverId")}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Selecione um colaborador...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name ?? u.id}</option>
                    ))}
                  </select>
                  {errors.receiverId && <p className="text-red-500 text-xs">{errors.receiverId.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Mensagem</Label>
                  <Textarea
                    {...register("content")}
                    placeholder="Escreva seu feedback aqui... Seja construtivo e específico."
                    rows={6}
                  />
                  {errors.content && <p className="text-red-500 text-xs">{errors.content.message}</p>}
                </div>

                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Feedback enviado com sucesso!
                  </div>
                )}

                <Button type="submit" disabled={sending} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? "Enviando..." : "Enviar anonimamente"}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* ── ALL (privileged) ── */}
        {tab === "all" && isPrivileged && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <Eye className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">Visão privilegiada</p>
                <p className="text-amber-700 text-sm mt-1">
                  Como liderança, você pode ver todos os feedbacks e os remetentes descriptografados.
                  Use estas informações com responsabilidade.
                </p>
              </div>
            </div>

            {/* Filter by receiver */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 whitespace-nowrap">Filtrar por destinatário:</label>
              <select
                value={filterReceiver}
                onChange={(e) => setFilterReceiver(e.target.value)}
                className="h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Todos</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.id}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400 ml-auto">{filteredAll.length} feedback(s)</span>
            </div>

            {loadingAll ? (
              <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
            ) : filteredAll.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
                <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400">Nenhum feedback encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAll.map((f) => (
                  <div key={f.id}
                    className={`bg-white border rounded-xl p-4 ${f.read ? "border-gray-200" : "border-amber-300 bg-amber-50/20"}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Sender → Receiver */}
                        <div className="flex items-center gap-2 mb-2 text-xs">
                          <span className="flex items-center gap-1 font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                            {f.senderName ?? "Usuário removido"}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                          <span className="flex items-center gap-1 font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                            {f.receiver.name ?? f.receiver.id}
                          </span>
                          <span className="ml-auto text-gray-400">{formatDate(f.createdAt)}</span>
                          {!f.read && <span className="w-2 h-2 bg-amber-500 rounded-full shrink-0" />}
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed">{f.content}</p>
                        {f.anonymous && (
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <EyeOff className="w-3 h-3" /> Enviado como anônimo — remetente descriptografado
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => markRead(f.id, !f.read)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                      >
                        {f.read
                          ? <><Circle className="w-3.5 h-3.5" /> Não lido</>
                          : <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Lido</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
