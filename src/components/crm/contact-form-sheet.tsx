"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  cpf: z.string().optional(),
  status: z.enum(["LEAD", "PROSPECT", "ACTIVE", "INACTIVE", "LOST"]),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Contact {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  cpf?: string | null
  status: FormData["status"]
  notes?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact
  onSaved: () => void
}

const STATUS_OPTIONS = [
  { value: "LEAD", label: "Lead" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "INACTIVE", label: "Inativo" },
  { value: "LOST", label: "Perdido" },
]

export function ContactFormSheet({ open, onOpenChange, contact, onSaved }: Props) {
  const isEdit = !!contact

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "LEAD" },
  })

  useEffect(() => {
    if (open) {
      reset(
        contact
          ? {
              name: contact.name,
              email: contact.email ?? "",
              phone: contact.phone ?? "",
              whatsapp: contact.whatsapp ?? "",
              cpf: contact.cpf ?? "",
              status: contact.status,
              notes: contact.notes ?? "",
            }
          : { status: "LEAD" },
      )
    }
  }, [open, contact, reset])

  async function onSubmit(data: FormData) {
    const url = isEdit ? `/api/crm/contatos/${contact!.id}` : "/api/crm/contatos"
    const method = isEdit ? "PATCH" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      onSaved()
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{isEdit ? "Editar Contato" : "Novo Contato"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" {...register("name")} placeholder="Nome completo" />
            {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} placeholder="email@exemplo.com" />
              {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" {...register("cpf")} placeholder="000.000.000-00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" {...register("phone")} placeholder="(11) 9999-0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" {...register("whatsapp")} placeholder="(11) 99999-0000" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              {...register("status")}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Notas sobre o contato..." rows={3} />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar contato"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
