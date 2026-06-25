"use client"

import { useEffect, useState, useRef } from "react"
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
import { TrendingUp, Search, X } from "lucide-react"

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
  // Keep +55 prefix if present
  const hasPrefix = raw.startsWith("+55")
  const stripped = raw.replace(/^\+55\s*/, "")
  const d = stripped.replace(/\D/g, "").slice(0, 11)
  let local = ""
  if (d.length === 0) local = ""
  else if (d.length <= 2) local = `(${d}`
  else if (d.length <= 6) local = `(${d.slice(0, 2)}) ${d.slice(2)}`
  else if (d.length <= 10) local = `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  else local = `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
  return hasPrefix ? `+55 ${local}` : local
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
  position: z.string().optional(),
  leadSource: z.string().optional(),
  status: z.enum(["LEAD", "PROSPECT", "ACTIVE", "INACTIVE", "LOST"]),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const LEAD_SOURCES = [
  { value: "", label: "Não informado" },
  { value: "ORGANIC", label: "Orgânico" },
  { value: "REFERRAL", label: "Indicação" },
  { value: "SOCIAL_MEDIA", label: "Redes sociais" },
  { value: "PAID_ADS", label: "Anúncio pago" },
  { value: "EVENT", label: "Evento" },
  { value: "COLD_OUTREACH", label: "Prospecção ativa" },
  { value: "OTHER", label: "Outro" },
]

interface Contact {
  id: string; name: string; email?: string | null
  phone?: string | null; whatsapp?: string | null
  cpf?: string | null; cnpj?: string | null; razaoSocial?: string | null
  position?: string | null; leadSource?: string | null
  status: FormData["status"]; notes?: string | null
}

interface ClienteResult {
  id: string; name: string; email?: string | null; phone?: string | null
  whatsapp?: string | null; cpf?: string | null; cnpj?: string | null; razaoSocial?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact
  onSaved: () => void
  defaultStatus?: FormData["status"]
}

const STATUS_OPTIONS = [
  { value: "LEAD", label: "Lead" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "INACTIVE", label: "Inativo" },
  { value: "LOST", label: "Perdido" },
]

export function ContactFormSheet({ open, onOpenChange, contact, onSaved, defaultStatus = "LEAD" }: Props) {
  const isEdit = !!contact

  const [phone, setPhone] = useState("+55 ")
  const [whatsapp, setWhatsapp] = useState("+55 ")
  const [cpfVal, setCpfVal] = useState("")
  const [cnpjVal, setCnpjVal] = useState("")
  const [creditDialog, setCreditDialog] = useState(false)
  const [creditLimit, setCreditLimit] = useState<number | null>(null)

  // Cliente search
  const [clienteSearch, setClienteSearch] = useState("")
  const [clienteResults, setClienteResults] = useState<ClienteResult[]>([])
  const [clienteSearching, setClienteSearching] = useState(false)
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { status: defaultStatus, docType: "cpf" },
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
        position: contact.position ?? "",
        leadSource: contact.leadSource ?? "",
        status: contact.status,
        notes: contact.notes ?? "",
      })
      setPhone(contact.phone ?? "+55 ")
      setWhatsapp(contact.whatsapp ?? "+55 ")
      setCpfVal(contact.cpf ?? "")
      setCnpjVal(contact.cnpj ?? "")
    } else {
      reset({ status: defaultStatus, docType: "cpf" })
      setPhone("+55 "); setWhatsapp("+55 "); setCpfVal(""); setCnpjVal("")
      setClienteSearch(""); setClienteResults([])
    }
  }, [open, contact, reset, defaultStatus])

  function handleClienteSearchChange(q: string) {
    setClienteSearch(q)
    setShowClienteDropdown(true)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (!q.trim()) { setClienteResults([]); return }
    searchDebounce.current = setTimeout(async () => {
      setClienteSearching(true)
      try {
        const res = await fetch(`/api/clientes?q=${encodeURIComponent(q)}`)
        if (res.ok) setClienteResults(await res.json())
      } finally { setClienteSearching(false) }
    }, 300)
  }

  function importarCliente(c: ClienteResult) {
    const hasCnpj = !!c.cnpj
    const dt = hasCnpj ? "cnpj" : "cpf"
    reset({
      name: c.name,
      email: c.email ?? "",
      docType: dt,
      cpf: c.cpf ?? "",
      cnpj: c.cnpj ?? "",
      razaoSocial: c.razaoSocial ?? "",
      status: defaultStatus,
    })
    setPhone(maskPhone(c.phone ?? ""))
    setWhatsapp(maskPhone(c.whatsapp ?? ""))
    setCpfVal(c.cpf ? maskCpf(c.cpf) : "")
    setCnpjVal(c.cnpj ? maskCnpj(c.cnpj) : "")
    setClienteSearch("")
    setClienteResults([])
    setShowClienteDropdown(false)
  }

  async function onSubmit(data: FormData) {
    const payload = {
      name: data.name,
      email: data.email || undefined,
      phone: phone || undefined,
      whatsapp: whatsapp || undefined,
      cpf: data.docType === "cpf" ? cpfVal || undefined : undefined,
      cnpj: data.docType === "cnpj" ? cnpjVal || undefined : undefined,
      razaoSocial: data.docType === "cnpj" ? (data.razaoSocial || undefined) : undefined,
      position: data.position || undefined,
      leadSource: data.leadSource || undefined,
      creditLimit: creditLimit ?? undefined,
      status: data.status,
      notes: data.notes || undefined,
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
          {/* Importar de cliente existente (apenas criação) */}
          {!isEdit && (
            <div className="relative">
              <Label className="text-xs text-gray-500">Importar dados de cliente existente</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  value={clienteSearch}
                  onChange={(e) => handleClienteSearchChange(e.target.value)}
                  onFocus={() => clienteSearch && setShowClienteDropdown(true)}
                  placeholder="Buscar por nome, CPF ou CNPJ..."
                  className="pl-8 h-9 text-sm"
                />
                {clienteSearch && (
                  <button type="button" onClick={() => { setClienteSearch(""); setClienteResults([]); setShowClienteDropdown(false) }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {showClienteDropdown && (clienteResults.length > 0 || clienteSearching) && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clienteSearching && <p className="px-3 py-2 text-xs text-gray-400">Buscando...</p>}
                  {clienteResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => importarCliente(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.cnpj ?? c.cpf ?? c.phone ?? ""}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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

          {/* Cargo + Origem */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input {...register("position")} placeholder="Ex: Diretor, Gerente..." />
            </div>
            <div className="space-y-1.5">
              <Label>Origem do lead</Label>
              <select
                {...register("leadSource")}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {LEAD_SOURCES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
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
