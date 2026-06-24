"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CreditCheckDialog } from "@/components/clientes/credit-check-dialog"
import { TrendingUp } from "lucide-react"

// ─── Masks ────────────────────────────────────────────────────────────────────

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11)
  if (d.length === 0) return ""
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  // 11 dígitos → celular: (xx) x xxxx-xxxx
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
}

// ─── Masked input component ───────────────────────────────────────────────────

function MaskedInput({
  mask, value, onChange, placeholder, id,
}: {
  mask: (v: string) => string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(mask(e.target.value))
  }

  return (
    <Input id={id} value={value} onChange={handleChange} placeholder={placeholder} />
  )
}

// ─── Schema & types ───────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  docType: z.enum(["cpf", "cnpj"]),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  razaoSocial: z.string().optional(),
  status: z.enum(["LEAD", "PROSPECT", "ACTIVE", "INACTIVE", "LOST"]),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Contact {
  id: string; name: string; email?: string | null
  phone?: string | null; whatsapp?: string | null
  cpf?: string | null; cnpj?: string | null; razaoSocial?: string | null
  status: FormData["status"]; notes?: string | null
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

  // Controlled values for masked inputs
  const [phone, setPhone] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [cpfVal, setCpfVal] = useState("")
  const [cnpjVal, setCnpjVal] = useState("")
  const [creditDialog, setCreditDialog] = useState(false)
  const [creditLimit, setCreditLimit] = useState<number | null>(null)

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { status: "LEAD", docType: "cpf" },
  })

  const docType = watch("docType")

  useEffect(() => {
    if (!open) return
    if (contact) {
      const hasCnpj = !!contact.cnpj
      const dt = hasCnpj ? "cnpj" : "cpf"
      reset({
        name: contact.name,
        email: contact.email ?? "",
        docType: dt,
        cpf: contact.cpf ?? "",
        cnpj: contact.cnpj ?? "",
        razaoSocial: contact.razaoSocial ?? "",
        status: contact.status,
        notes: contact.notes ?? "",
      })
      setPhone(contact.phone ?? "")
      setWhatsapp(contact.whatsapp ?? "")
      setCpfVal(contact.cpf ?? "")
      setCnpjVal(contact.cnpj ?? "")
    } else {
      reset({ status: "LEAD", docType: "cpf" })
      setPhone(""); setWhatsapp(""); setCpfVal(""); setCnpjVal("")
    }
  }, [open, contact, reset])

  async function onSubmit(data: FormData) {
    const payload = {
      name: data.name,
      email: data.email || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      cpf: data.docType === "cpf" ? cpfVal || null : null,
      cnpj: data.docType === "cnpj" ? cnpjVal || null : null,
      razaoSocial: data.docType === "cnpj" ? (data.razaoSocial || null) : null,
      creditLimit: creditLimit ?? undefined,
      status: data.status,
      notes: data.notes || null,
    }

    const url = isEdit ? `/api/crm/contatos/${contact!.id}` : "/api/crm/contatos"
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (res.ok) { onSaved(); onOpenChange(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{isEdit ? "Editar Contato" : "Novo Contato"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" {...register("name")} placeholder="Nome completo" />
            {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} placeholder="email@exemplo.com" />
            {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
          </div>

          {/* Telefone + WhatsApp */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <MaskedInput mask={maskPhone} value={phone} onChange={setPhone} placeholder="(11) 9 1234-5678" />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <MaskedInput mask={maskPhone} value={whatsapp} onChange={setWhatsapp} placeholder="(11) 9 1234-5678" />
            </div>
          </div>

          {/* CPF / CNPJ toggle */}
          <div className="space-y-2">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
              {(["cpf", "cnpj"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setValue("docType", type); setCpfVal(""); setCnpjVal("") }}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${docType === type ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>

            {docType === "cpf" ? (
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <MaskedInput mask={maskCpf} value={cpfVal} onChange={setCpfVal} placeholder="000.000.000-00" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>CNPJ</Label>
                    {cnpjVal.replace(/\D/g, "").length === 14 && (
                      <button
                        type="button"
                        onClick={() => setCreditDialog(true)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        Verificar crédito
                      </button>
                    )}
                  </div>
                  <MaskedInput mask={maskCnpj} value={cnpjVal} onChange={setCnpjVal} placeholder="00.000.000/0001-00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Razão Social</Label>
                  <Input {...register("razaoSocial")} placeholder="Nome jurídico da empresa" />
                </div>
                {creditLimit !== null && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-xs text-green-700">
                      Limite de crédito aplicado: <strong>R$ {creditLimit.toLocaleString("pt-BR")}</strong>
                    </span>
                    <button type="button" onClick={() => setCreditLimit(null)} className="ml-auto text-green-500 hover:text-green-700 text-xs">✕</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              {...register("status")}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea {...register("notes")} placeholder="Notas sobre o contato..." rows={3} />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar contato"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>

      <CreditCheckDialog
        open={creditDialog}
        onOpenChange={setCreditDialog}
        cnpj={cnpjVal}
        onApply={({ razaoSocial, creditLimit: limit }) => {
          setValue("razaoSocial", razaoSocial)
          setCreditLimit(limit)
        }}
      />
    </Sheet>
  )
}
