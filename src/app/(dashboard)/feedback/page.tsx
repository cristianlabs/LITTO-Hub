"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Shield, MessageSquare } from "lucide-react"

const schema = z.object({
  receiverId: z.string().min(1, "Selecione um destinatário"),
  content: z.string().min(10, "Mínimo de 10 caracteres"),
})

type FormData = z.infer<typeof schema>

interface User {
  id: string
  name: string | null
  role: string
}

export default function FeedbackPage() {
  const [users, setUsers] = useState<User[]>([])
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {})
  }, [])

  async function onSubmit(data: FormData) {
    setLoading(true)
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
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Header title="Feedback" subtitle="Envie feedbacks anônimos para colegas" />

      <div className="p-6 max-w-2xl space-y-6">
        {/* Privacy banner */}
        <div className="flex items-start gap-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <Shield className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 text-sm">Sua identidade está protegida</h3>
            <p className="text-blue-700 text-sm mt-1">
              Os feedbacks são enviados de forma completamente anônima. Sua identidade é criptografada
              com AES-256 e só pode ser revelada pela liderança em casos específicos previstos na
              política da empresa.
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4" />
              Enviar Feedback Anônimo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="receiverId">Para quem é este feedback?</Label>
                <select
                  id="receiverId"
                  {...register("receiverId")}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Selecione um colaborador...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.id}
                    </option>
                  ))}
                </select>
                {errors.receiverId && (
                  <p className="text-red-500 text-xs">{errors.receiverId.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="content">Mensagem</Label>
                <Textarea
                  id="content"
                  {...register("content")}
                  placeholder="Escreva seu feedback aqui..."
                  rows={5}
                />
                {errors.content && (
                  <p className="text-red-500 text-xs">{errors.content.message}</p>
                )}
              </div>

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
                  Feedback enviado com sucesso!
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Enviando..." : "Enviar feedback anonimamente"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
