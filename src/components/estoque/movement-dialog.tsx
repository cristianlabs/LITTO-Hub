"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react"

const schema = z.object({
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number().int().min(1, "Mínimo 1"),
  reason: z.string().optional(),
  reference: z.string().optional(),
  cost: z.number().min(0).optional(),
})

type FormData = z.infer<typeof schema>

interface Product {
  id: string
  name: string
  sku: string
  currentStock: number
  unit: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product
  defaultType?: "IN" | "OUT" | "ADJUSTMENT"
  onSaved: () => void
}

export function MovementDialog({ open, onOpenChange, product, defaultType = "IN", onSaved }: Props) {
  const [error, setError] = useState("")

  const { register, handleSubmit, watch, reset, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { type: defaultType, quantity: 1 },
  })

  const type = watch("type")
  const quantity = watch("quantity") || 0

  const preview =
    type === "ADJUSTMENT"
      ? quantity
      : type === "IN"
        ? product.currentStock + quantity
        : product.currentStock - quantity

  async function onSubmit(data: FormData) {
    setError("")
    const res = await fetch("/api/estoque/movimentacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, productId: product.id }),
    })

    if (res.ok) {
      reset()
      onSaved()
      onOpenChange(false)
    } else {
      const err = await res.json()
      setError(err.error ?? "Erro ao registrar movimentação")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Movimentação de Estoque</DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-900">{product.name}</p>
          <p className="text-xs text-gray-500">SKU: {product.sku} · Atual: <strong>{product.currentStock} {product.unit}</strong></p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "IN", label: "Entrada", icon: ArrowDown, color: "border-green-500 bg-green-50 text-green-700" },
              { value: "OUT", label: "Saída", icon: ArrowUp, color: "border-red-500 bg-red-50 text-red-700" },
              { value: "ADJUSTMENT", label: "Ajuste", icon: SlidersHorizontal, color: "border-blue-500 bg-blue-50 text-blue-700" },
            ] as const).map(({ value, label, icon: Icon, color }) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" value={value} {...register("type")} className="sr-only peer" />
                <div className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border-2 text-xs font-medium transition-colors peer-checked:${color} border-gray-200 text-gray-500 hover:border-gray-300`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </div>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>{type === "ADJUSTMENT" ? "Novo estoque total" : "Quantidade"}</Label>
            <Input {...register("quantity")} type="number" min="1" autoFocus />
          </div>

          {/* Preview */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
            <span className="text-gray-500">Estoque após:</span>
            <span className={`font-bold ${preview < 0 ? "text-red-600" : preview === 0 ? "text-orange-600" : "text-gray-900"}`}>
              {preview} {product.unit}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Input {...register("reason")} placeholder="Ex: Compra NF 1234, Venda, Devolução..." />
          </div>

          <div className="space-y-1.5">
            <Label>Referência / NF</Label>
            <Input {...register("reference")} placeholder="Número da NF ou pedido" />
          </div>

          {type === "IN" && (
            <div className="space-y-1.5">
              <Label>Custo unitário (R$)</Label>
              <Input {...register("cost")} type="number" step="0.01" placeholder="0,00" />
            </div>
          )}

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || preview < 0} className="flex-1">
              {isSubmitting ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
