import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Header } from "@/components/layout/header"
import { FinanceiroClient } from "@/components/financeiro/financeiro-client"
import { BILL_CATEGORIES } from "@/lib/financeiro-constants"

export default async function FinanceiroPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)
  const today = new Date()

  const [rawBills, rawReceivables, rawBudgets, bankAccounts] = await Promise.all([
    db.bill.findMany({
      orderBy: { dueDate: "asc" },
      include: { bankAccount: { select: { id: true, name: true } } },
    }),
    db.receivable.findMany({
      orderBy: { dueDate: "asc" },
      include: {
        contact: { select: { id: true, name: true } },
        bankAccount: { select: { id: true, name: true } },
      },
    }),
    db.budget.findMany({ where: { year, month }, orderBy: { category: "asc" } }),
    db.bankAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ])

  const bills = rawBills.map((b) => ({
    ...b, amount: Number(b.amount),
    status: b.status === "PENDING" && new Date(b.dueDate) < today ? "OVERDUE" : b.status,
    dueDate: b.dueDate.toISOString(), paidAt: b.paidAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString(),
  }))

  const receivables = rawReceivables.map((r) => ({
    ...r, amount: Number(r.amount),
    status: r.status === "PENDING" && new Date(r.dueDate) < today ? "OVERDUE" : r.status,
    dueDate: r.dueDate.toISOString(), receivedAt: r.receivedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }))

  const budgets = rawBudgets.map((b) => ({ ...b, planned: Number(b.planned) }))

  // Actual spending/income per category for the current month
  const [monthBills, monthReceivables] = await Promise.all([
    db.bill.findMany({ where: { dueDate: { gte: startDate, lte: endDate }, status: "PAID" }, select: { category: true, amount: true } }),
    db.receivable.findMany({ where: { dueDate: { gte: startDate, lte: endDate }, status: "RECEIVED" }, select: { category: true, amount: true } }),
  ])

  const catMap: Record<string, { paid: number; received: number }> = {}
  for (const cat of BILL_CATEGORIES) catMap[cat] = { paid: 0, received: 0 }
  monthBills.forEach((b) => { if (!catMap[b.category]) catMap[b.category] = { paid: 0, received: 0 }; catMap[b.category].paid += Number(b.amount) })
  monthReceivables.forEach((r) => { if (!catMap[r.category]) catMap[r.category] = { paid: 0, received: 0 }; catMap[r.category].received += Number(r.amount) })
  const actualData = Object.entries(catMap).map(([category, v]) => ({ category, ...v }))

  // Flow data
  const totalBalance = bankAccounts.reduce((s, a) => s + Number(a.balance), 0)
  const pendingBills = bills.filter((b) => b.status === "PENDING").reduce((s, b) => s + b.amount, 0)
  const pendingReceivables = receivables.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.amount, 0)
  const daysInMonth = endDate.getDate()
  const dailyFlow = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    return {
      day,
      saidas: bills.filter((b) => new Date(b.dueDate).getDate() === day && new Date(b.dueDate).getMonth() === month - 1).reduce((s, b) => s + b.amount, 0),
      entradas: receivables.filter((r) => new Date(r.dueDate).getDate() === day && new Date(r.dueDate).getMonth() === month - 1).reduce((s, r) => s + r.amount, 0),
    }
  })

  const flowData = {
    totalBalance,
    projectedBalance: totalBalance + pendingReceivables - pendingBills,
    bills: {
      total: bills.reduce((s, b) => s + b.amount, 0),
      paid: bills.filter((b) => b.status === "PAID").reduce((s, b) => s + b.amount, 0),
      pending: pendingBills,
      count: bills.length,
    },
    receivables: {
      total: receivables.reduce((s, r) => s + r.amount, 0),
      received: receivables.filter((r) => r.status === "RECEIVED").reduce((s, r) => s + r.amount, 0),
      pending: pendingReceivables,
      count: receivables.length,
    },
    dailyFlow,
    bankAccounts: bankAccounts.map((a) => ({ ...a, balance: Number(a.balance) })),
  }

  return (
    <div>
      <Header title="Financeiro" subtitle="Contas a pagar, a receber, planejamento e tesouraria" />
      <FinanceiroClient
        bills={bills as never}
        receivables={receivables as never}
        budgets={budgets as never}
        actualData={actualData as never}
        bankAccounts={bankAccounts.map((a) => ({ ...a, balance: Number(a.balance) })) as never}
        flowData={flowData as never}
        year={year}
        month={month}
      />
    </div>
  )
}
