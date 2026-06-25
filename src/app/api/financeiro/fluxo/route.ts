import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get("year") ?? new Date().getFullYear())
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1)

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  const [bills, receivables, bankAccounts] = await Promise.all([
    db.bill.findMany({
      where: { dueDate: { gte: startDate, lte: endDate } },
      orderBy: { dueDate: "asc" },
    }),
    db.receivable.findMany({
      where: { dueDate: { gte: startDate, lte: endDate } },
      orderBy: { dueDate: "asc" },
    }),
    db.bankAccount.findMany({ where: { active: true } }),
  ])

  const totalBalance = bankAccounts.reduce((s, a) => s + Number(a.balance), 0)

  const totalBills = bills.reduce((s, b) => s + Number(b.amount), 0)
  const paidBills = bills.filter((b) => b.status === "PAID").reduce((s, b) => s + Number(b.amount), 0)
  const pendingBills = bills.filter((b) => b.status === "PENDING").reduce((s, b) => s + Number(b.amount), 0)

  const totalReceivables = receivables.reduce((s, r) => s + Number(r.amount), 0)
  const receivedReceivables = receivables.filter((r) => r.status === "RECEIVED").reduce((s, r) => s + Number(r.amount), 0)
  const pendingReceivables = receivables.filter((r) => r.status === "PENDING").reduce((s, r) => s + Number(r.amount), 0)

  // Build daily cash flow for the month
  const daysInMonth = endDate.getDate()
  const dailyFlow: { day: number; saidas: number; entradas: number }[] = []

  for (let d = 1; d <= daysInMonth; d++) {
    const dayBills = bills.filter((b) => new Date(b.dueDate).getDate() === d)
    const dayReceivables = receivables.filter((r) => new Date(r.dueDate).getDate() === d)
    dailyFlow.push({
      day: d,
      saidas: dayBills.reduce((s, b) => s + Number(b.amount), 0),
      entradas: dayReceivables.reduce((s, r) => s + Number(r.amount), 0),
    })
  }

  return NextResponse.json({
    totalBalance,
    bankAccounts: bankAccounts.map((a) => ({ ...a, balance: Number(a.balance) })),
    bills: { total: totalBills, paid: paidBills, pending: pendingBills, count: bills.length },
    receivables: { total: totalReceivables, received: receivedReceivables, pending: pendingReceivables, count: receivables.length },
    projectedBalance: totalBalance + pendingReceivables - pendingBills,
    dailyFlow,
  })
}
