"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const schema = z.object({
  sku: z.string().min(1, "SKU obrigatório"),
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  costPrice: z.coerce.number().min(0).default(0),
  salePrice: z.coerce.number().min(0).default(0),
  unit: z.string().default("un"),
  minStock: z.coerce.number().int().min(0).default(0),
  maxStock: z.coerce.number().int().min(0).default(100),
})

type FormData = z.infer<typeof schema>

interface Category { id: string; name: string; color: string }
interface Supplier { id: string; name: string }

interface Product {
  id: string; sku: string; name: string; description?: string | null
  barcode?: string | null; categoryId?: string | null; supplierId?: string | null
  costPrice: number | null; salePrice: number | null
  unit: string; minStock: number; maxStock: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product
  categories: Category[]
  suppliers: Supplier[]
  onSaved: () => void
}

export function ProductFormSheet({ open, onOpenChange, product, categories, suppliers, onSaved }: Props) {
  const isEdit = !!product

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { unit: "un", minStock: 0, maxStock: 100, costPrice: 0, salePrice: 0 },
  })

  useEffect(() => {
    if (open) {
      reset(product ? {
        sku: product.sku, name: product.name,
        description: product.description ?? "",
        barcode: product.barcode ?? "",
        categoryId: product.categoryId ?? "",
        supplierId: product.supplierId ?? "",
        costPrice: product.costPrice ?? 0,
        salePrice: product.salePrice ?? 0,
        unit: product.unit, minStock: product.minStock, maxStock: product.maxStock,
      } : { unit: "un", minStock: 0, maxStock: 100, costPrice: 0, salePrice: 0 })
    }
  }, [open, product, reset])

  async function onSubmit(data: FormData) {
    const url = isEdit ? `/api/estoque/produtos/${product!.id}` : "/api/estoque/produtos"
    const method = isEdit ? "PATCH" : "POST"

    const payload = {
      ...data,
      categoryId: data.categoryId || null,
      supplierId: data.supplierId || null,
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (res.ok) { onSaved(); onOpenChange(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{isEdit ? "Editar Produto" : "Novo Produto"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SKU *</Label>
              <Input {...register("sku")} placeholder="PROD-001" />
              {errors.sku && <p className="text-red-500 text-xs">{errors.sku.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Código de barras</Label>
              <Input {...register("barcode")} placeholder="7891000000000" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input {...register("name")} placeholder="Nome do produto" />
            {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea {...register("description")} rows={2} placeholder="Descrição opcional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <select {...register("categoryId")} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Sem categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <select {...register("supplierId")} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Sem fornecedor</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Preço custo (R$)</Label>
              <Input {...register("costPrice")} type="number" step="0.01" placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Preço venda (R$)</Label>
              <Input {...register("salePrice")} type="number" step="0.01" placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Input {...register("unit")} placeholder="un" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estoque mínimo</Label>
              <Input {...register("minStock")} type="number" min="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Estoque máximo</Label>
              <Input {...register("maxStock")} type="number" min="0" />
            </div>
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar produto"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
