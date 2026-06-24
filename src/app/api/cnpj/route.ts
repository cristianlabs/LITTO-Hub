import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export interface CnpjData {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  situacao: string       // "ATIVA" | "INAPTA" | "SUSPENSA" | "BAIXADA"
  dataAbertura: string
  capitalSocial: number
  email: string
  telefone: string
  logradouro: string
  numero: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  atividadePrincipal: string
  creditScore: number    // 0–1000
  creditRisk: "MUITO_BAIXO" | "BAIXO" | "MEDIO" | "ALTO" | "MUITO_ALTO"
  creditLimit: number
  creditNotes: string[]
}

function calcScore(data: {
  situacao: string
  dataAbertura: string
  capitalSocial: number
}): { score: number; risk: CnpjData["creditRisk"]; limit: number; notes: string[] } {
  const notes: string[] = []
  let score = 500

  // Situação cadastral
  if (data.situacao === "ATIVA") {
    score += 200
  } else if (data.situacao === "SUSPENSA") {
    score -= 200
    notes.push("Empresa com situação SUSPENSA na Receita Federal")
  } else if (data.situacao === "INAPTA") {
    score -= 400
    notes.push("Empresa INAPTA — alto risco de inadimplência")
  } else if (data.situacao === "BAIXADA") {
    score -= 500
    notes.push("Empresa BAIXADA — não operar crédito")
  }

  // Tempo de atividade
  const openYear = parseInt(data.dataAbertura?.split("/").pop() ?? "0")
  const yearsOpen = openYear > 0 ? new Date().getFullYear() - openYear : 0
  if (yearsOpen >= 10) { score += 150; notes.push(`Empresa com ${yearsOpen} anos de atividade`) }
  else if (yearsOpen >= 5) { score += 80; notes.push(`Empresa com ${yearsOpen} anos de atividade`) }
  else if (yearsOpen >= 2) { score += 30 }
  else if (yearsOpen < 1) { score -= 100; notes.push("Empresa com menos de 1 ano — risco elevado") }

  // Capital social
  if (data.capitalSocial >= 500000) score += 150
  else if (data.capitalSocial >= 100000) score += 80
  else if (data.capitalSocial >= 10000) score += 30
  else if (data.capitalSocial < 1000) { score -= 50; notes.push("Capital social muito baixo") }

  score = Math.max(0, Math.min(1000, score))

  let risk: CnpjData["creditRisk"]
  let limit: number

  if (score >= 800) { risk = "MUITO_BAIXO"; limit = Math.min(data.capitalSocial * 0.3, 500000) }
  else if (score >= 650) { risk = "BAIXO"; limit = Math.min(data.capitalSocial * 0.2, 200000) }
  else if (score >= 450) { risk = "MEDIO"; limit = Math.min(data.capitalSocial * 0.1, 50000) }
  else if (score >= 250) { risk = "ALTO"; limit = Math.min(data.capitalSocial * 0.05, 10000) }
  else { risk = "MUITO_ALTO"; limit = 0; notes.push("Crédito não recomendado") }

  if (notes.length === 0) notes.push("Empresa em situação regular na Receita Federal")

  return { score, risk, limit: Math.round(limit), notes }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cnpj = new URL(req.url).searchParams.get("cnpj")
  if (!cnpj) return NextResponse.json({ error: "CNPJ obrigatório" }, { status: 400 })

  const digits = cnpj.replace(/\D/g, "")
  if (digits.length !== 14) return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 })

  try {
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // cache 1h
    })

    if (!res.ok) {
      if (res.status === 429) return NextResponse.json({ error: "Limite de consultas atingido. Tente em 1 minuto." }, { status: 429 })
      return NextResponse.json({ error: "CNPJ não encontrado" }, { status: 404 })
    }

    const raw = await res.json()
    if (raw.status === "ERROR") return NextResponse.json({ error: raw.message ?? "CNPJ não encontrado" }, { status: 404 })

    const { score, risk, limit, notes } = calcScore({
      situacao: raw.situacao ?? "",
      dataAbertura: raw.abertura ?? "",
      capitalSocial: parseFloat(String(raw.capital_social ?? "0").replace(/\./g, "").replace(",", ".")) || 0,
    })

    const result: CnpjData = {
      cnpj: raw.cnpj ?? digits,
      razaoSocial: raw.nome ?? "",
      nomeFantasia: raw.fantasia ?? "",
      situacao: raw.situacao ?? "",
      dataAbertura: raw.abertura ?? "",
      capitalSocial: parseFloat(String(raw.capital_social ?? "0").replace(/\./g, "").replace(",", ".")) || 0,
      email: raw.email ?? "",
      telefone: raw.telefone ?? "",
      logradouro: raw.logradouro ?? "",
      numero: raw.numero ?? "",
      bairro: raw.bairro ?? "",
      municipio: raw.municipio ?? "",
      uf: raw.uf ?? "",
      cep: raw.cep ?? "",
      atividadePrincipal: raw.atividade_principal?.[0]?.text ?? "",
      creditScore: score,
      creditRisk: risk,
      creditLimit: limit,
      creditNotes: notes,
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Erro ao consultar CNPJ. Verifique a conexão." }, { status: 500 })
  }
}
