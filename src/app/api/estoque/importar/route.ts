import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { hasMinRole } from "@/lib/permissions"
import * as XLSX from "xlsx"

interface RowData {
  sku?: unknown
  SKU?: unknown
  nome?: unknown
  Nome?: unknown
  NOME?: unknown
  descricao?: unknown
  Descricao?: unknown
  "Descrição"?: unknown
  categoria?: unknown
  Categoria?: unknown
  fornecedor?: unknown
  Fornecedor?: unknown
  preco_custo?: unknown
  "Preço Custo"?: unknown
  preco_venda?: unknown
  "Preço Venda"?: unknown
  unidade?: unknown
  Unidade?: unknown
  estoque?: unknown
  Estoque?: unknown
  estoque_atual?: unknown
  "Estoque Atual"?: unknown
  estoque_minimo?: unknown
  "Estoque Mínimo"?: unknown
  estoque_maximo?: unknown
  "Estoque Máximo"?: unknown
  [key: string]: unknown
}

function pick(row: RowData, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

function pickNum(row: RowData, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null) {
      const n = Number(v)
      if (!isNaN(n)) return n
    }
  }
  return 0
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasMinRole(session.user.role, "MANAGER")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<RowData>(sheet, { defval: "" })

  if (rows.length === 0) return NextResponse.json({ error: "Planilha vazia ou formato inválido" }, { status: 400 })

  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] }

  for (const [idx, row] of rows.entries()) {
    const rowNum = idx + 2 // header is row 1

    const sku = pick(row, "sku", "SKU", "Sku", "codigo", "Codigo", "Código")
    const name = pick(row, "nome", "Nome", "NOME", "name", "Name", "produto", "Produto")

    if (!name) {
      results.errors.push(`Linha ${rowNum}: coluna "nome" ausente — pulada`)
      results.skipped++
      continue
    }

    // Auto-generate SKU if missing
    const finalSku = sku || `IMP-${Date.now()}-${idx}`

    const data = {
      name,
      description: pick(row, "descricao", "Descricao", "Descrição", "description") || null,
      unit: pick(row, "unidade", "Unidade", "unit", "un") || "un",
      costPrice: pickNum(row, "preco_custo", "Preço Custo", "preco custo", "custo", "Custo", "cost"),
      salePrice: pickNum(row, "preco_venda", "Preço Venda", "preco venda", "venda", "Venda", "price"),
      currentStock: Math.round(pickNum(row, "estoque", "Estoque", "estoque_atual", "Estoque Atual", "qty", "quantidade")),
      minStock: Math.round(pickNum(row, "estoque_minimo", "Estoque Mínimo", "estoque minimo", "min")),
      maxStock: Math.round(pickNum(row, "estoque_maximo", "Estoque Máximo", "estoque maximo", "max")) || 9999,
    }

    // Resolve category by name
    const catName = pick(row, "categoria", "Categoria", "category")
    let categoryId: string | undefined
    if (catName) {
      const existing = await db.productCategory.findFirst({ where: { name: catName }, select: { id: true } })
      if (existing) {
        categoryId = existing.id
      } else {
        const cat = await db.productCategory.create({ data: { name: catName }, select: { id: true } })
        categoryId = cat.id
      }
    }

    // Resolve supplier by name
    const supplierName = pick(row, "fornecedor", "Fornecedor", "supplier")
    let supplierId: string | undefined
    if (supplierName) {
      const sup = await db.supplier.findFirst({ where: { name: supplierName }, select: { id: true } })
      if (sup) supplierId = sup.id
    }

    try {
      const existing = await db.product.findUnique({ where: { sku: finalSku } })
      if (existing) {
        await db.product.update({
          where: { sku: finalSku },
          data: { ...data, ...(categoryId ? { categoryId } : {}), ...(supplierId ? { supplierId } : {}) },
        })
        results.updated++
      } else {
        await db.product.create({
          data: { sku: finalSku, ...data, ...(categoryId ? { categoryId } : {}), ...(supplierId ? { supplierId } : {}) },
        })
        results.created++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido"
      results.errors.push(`Linha ${rowNum} (${name}): ${msg}`)
      results.skipped++
    }
  }

  return NextResponse.json(results)
}
