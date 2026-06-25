import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

const isPrivileged = (role: string) => role === "OWNER" || role === "HEAD_LEADER"

export type CalendarEventType = "BILL" | "RECEIVABLE" | "DEAL" | "TASK" | "PURCHASE_ORDER"

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  title: string
  date: string        // ISO date string
  status?: string
  value?: number | null
  ownerName?: string | null
  link?: string
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1))

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const privileged = isPrivileged(session.user.role)
  const userId = session.user.id

  const events: CalendarEvent[] = []

  // ── Contas a Pagar (privileged only) ─────────────────────────────────────────
  if (privileged) {
    const bills = await db.bill.findMany({
      where: { dueDate: { gte: start, lte: end } },
      select: { id: true, title: true, amount: true, dueDate: true, status: true },
    })
    for (const b of bills) {
      events.push({
        id: b.id,
        type: "BILL",
        title: b.title,
        date: b.dueDate.toISOString(),
        status: b.status,
        value: Number(b.amount),
        link: "/financeiro",
      })
    }
  }

  // ── Contas a Receber (privileged only) ────────────────────────────────────────
  if (privileged) {
    const receivables = await db.receivable.findMany({
      where: { dueDate: { gte: start, lte: end } },
      select: { id: true, title: true, amount: true, dueDate: true, status: true, client: true },
    })
    for (const r of receivables) {
      events.push({
        id: r.id,
        type: "RECEIVABLE",
        title: r.title,
        date: r.dueDate.toISOString(),
        status: r.status,
        value: Number(r.amount),
        ownerName: r.client,
        link: "/financeiro",
      })
    }
  }

  // ── Vendas / Deals (expectedClose) ────────────────────────────────────────────
  const dealWhere = privileged
    ? { expectedClose: { gte: start, lte: end } }
    : { expectedClose: { gte: start, lte: end }, sellerId: userId }

  const deals = await db.deal.findMany({
    where: dealWhere,
    select: {
      id: true, title: true, value: true, expectedClose: true, status: true,
      seller: { select: { name: true } },
      contact: { select: { name: true } },
    },
  })
  for (const d of deals) {
    if (!d.expectedClose) continue
    events.push({
      id: d.id,
      type: "DEAL",
      title: d.title,
      date: d.expectedClose.toISOString(),
      status: d.status,
      value: d.value ? Number(d.value) : null,
      ownerName: privileged ? (d.seller?.name ?? null) : null,
      link: `/crm`,
    })
  }

  // ── Tarefas CRM (Activity TASK com dueDate) ───────────────────────────────────
  const taskWhere = privileged
    ? { type: "TASK" as const, dueDate: { gte: start, lte: end }, completed: false }
    : { type: "TASK" as const, dueDate: { gte: start, lte: end }, completed: false, userId }

  const tasks = await db.activity.findMany({
    where: taskWhere,
    select: {
      id: true, title: true, dueDate: true,
      user: { select: { name: true } },
      contact: { select: { id: true, name: true } },
    },
  })
  for (const t of tasks) {
    if (!t.dueDate) continue
    events.push({
      id: t.id,
      type: "TASK",
      title: t.title,
      date: t.dueDate.toISOString(),
      ownerName: privileged ? (t.user?.name ?? null) : null,
      link: t.contact ? `/crm/${t.contact.id}` : "/crm",
    })
  }

  // ── Pedidos de Compra ─────────────────────────────────────────────────────────
  const poWhere = privileged
    ? {
        OR: [
          { orderedAt: { gte: start, lte: end } },
          { receivedAt: { gte: start, lte: end } },
        ],
      }
    : {
        createdById: userId,
        OR: [
          { orderedAt: { gte: start, lte: end } },
          { receivedAt: { gte: start, lte: end } },
        ],
      }

  const pos = await db.purchaseOrder.findMany({
    where: poWhere,
    select: {
      id: true, number: true, title: true, totalValue: true,
      orderedAt: true, receivedAt: true, status: true,
      createdBy: { select: { name: true } },
    },
  })
  for (const p of pos) {
    const date = p.receivedAt ?? p.orderedAt
    if (!date) continue
    events.push({
      id: p.id,
      type: "PURCHASE_ORDER",
      title: `Pedido #${p.number} — ${p.title}`,
      date: date.toISOString(),
      status: p.status,
      value: Number(p.totalValue),
      ownerName: privileged ? (p.createdBy?.name ?? null) : null,
      link: "/compras",
    })
  }

  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return NextResponse.json(events)
}
