import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Iniciando seed...")

  // ─── Users ───────────────────────────────────────────────────────────────
  const password = await bcrypt.hash("senha123", 12)

  const [owner, lider, gestor, vendedora1, vendedora2] = await Promise.all([
    prisma.user.upsert({
      where: { email: "dono@empresa.com" },
      update: {},
      create: { email: "dono@empresa.com", name: "Carlos Dono", password, role: "OWNER" },
    }),
    prisma.user.upsert({
      where: { email: "lider@empresa.com" },
      update: {},
      create: { email: "lider@empresa.com", name: "Maria Líder", password, role: "HEAD_LEADER" },
    }),
    prisma.user.upsert({
      where: { email: "gestor@empresa.com" },
      update: {},
      create: { email: "gestor@empresa.com", name: "João Gestor", password, role: "MANAGER" },
    }),
    prisma.user.upsert({
      where: { email: "vendedora1@empresa.com" },
      update: {},
      create: { email: "vendedora1@empresa.com", name: "Ana Silva", password, role: "SELLER" },
    }),
    prisma.user.upsert({
      where: { email: "vendedora2@empresa.com" },
      update: {},
      create: { email: "vendedora2@empresa.com", name: "Carla Santos", password, role: "SELLER" },
    }),
  ])

  // ─── StockAlertConfig ────────────────────────────────────────────────────
  await Promise.all([
    prisma.stockAlertConfig.upsert({
      where: { userId: owner.id },
      update: {},
      create: { userId: owner.id, email: true, push: true, inApp: true },
    }),
    prisma.stockAlertConfig.upsert({
      where: { userId: gestor.id },
      update: {},
      create: { userId: gestor.id, email: true, push: false, inApp: true },
    }),
  ])

  // ─── CRM ─────────────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { cnpj: "12.345.678/0001-90" },
    update: {},
    create: {
      name: "Acme Distribuidora",
      cnpj: "12.345.678/0001-90",
      email: "contato@acme.com",
      phone: "(11) 3000-0000",
      city: "São Paulo",
      state: "SP",
    },
  })

  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        name: "Bruno Ferreira",
        email: "bruno@acme.com",
        phone: "(11) 99999-1111",
        whatsapp: "11999991111",
        status: "ACTIVE",
        companyId: company.id,
        tags: ["cliente-vip", "recorrente"],
      },
    }),
    prisma.contact.create({
      data: {
        name: "Fernanda Costa",
        email: "fernanda@email.com",
        phone: "(11) 99999-2222",
        whatsapp: "11999992222",
        status: "LEAD",
        tags: ["inbound"],
      },
    }),
    prisma.contact.create({
      data: {
        name: "Ricardo Oliveira",
        email: "ricardo@empresa.com",
        phone: "(21) 99999-3333",
        status: "PROSPECT",
        tags: ["outbound"],
      },
    }),
    prisma.contact.create({
      data: {
        name: "Patrícia Mendes",
        email: "patricia@distribuidora.com",
        phone: "(31) 99999-4444",
        status: "INACTIVE",
        companyId: company.id,
      },
    }),
    prisma.contact.create({
      data: {
        name: "Marcos Souza",
        email: "marcos@startup.io",
        phone: "(51) 99999-5555",
        whatsapp: "51999995555",
        status: "LOST",
        tags: ["concorrente"],
      },
    }),
  ])

  // ─── Pipelines ────────────────────────────────────────────────────────────
  const pipelineData = [
    { name: "Novos Leads", order: 1, color: "#6366f1" },
    { name: "Qualificados", order: 2, color: "#f59e0b" },
    { name: "Proposta Enviada", order: 3, color: "#3b82f6" },
    { name: "Negociação", order: 4, color: "#f97316" },
    { name: "Fechado (Ganho)", order: 5, color: "#22c55e" },
  ]

  const pipelines = await Promise.all(
    pipelineData.map((p) => prisma.pipeline.create({ data: p })),
  )

  await Promise.all([
    prisma.deal.create({
      data: {
        title: "Contrato Anual — Acme",
        value: 48000,
        pipelineId: pipelines[2].id,
        contactId: contacts[0].id,
        expectedClose: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.deal.create({
      data: {
        title: "Proposta Sistema ERP",
        value: 12500,
        pipelineId: pipelines[1].id,
        contactId: contacts[2].id,
        expectedClose: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.deal.create({
      data: {
        title: "Licença Software",
        value: 3600,
        pipelineId: pipelines[0].id,
        contactId: contacts[1].id,
      },
    }),
    prisma.deal.create({
      data: {
        title: "Renovação Mensal",
        value: 1800,
        pipelineId: pipelines[3].id,
        contactId: contacts[0].id,
        expectedClose: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  // ─── Activities ───────────────────────────────────────────────────────────
  await Promise.all([
    prisma.activity.create({
      data: {
        type: "CALL",
        title: "Ligação de follow-up",
        contactId: contacts[0].id,
        userId: vendedora1.id,
        completed: true,
      },
    }),
    prisma.activity.create({
      data: {
        type: "WHATSAPP",
        title: "Envio de proposta via WhatsApp",
        contactId: contacts[2].id,
        userId: vendedora2.id,
      },
    }),
    prisma.activity.create({
      data: {
        type: "MEETING",
        title: "Reunião de apresentação",
        contactId: contacts[1].id,
        userId: gestor.id,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.activity.create({
      data: {
        type: "NOTE",
        title: "Anotação: cliente prefere contato por email",
        contactId: contacts[3].id,
        userId: vendedora1.id,
        completed: true,
      },
    }),
  ])

  // ─── Estoque ──────────────────────────────────────────────────────────────
  const supplier = await prisma.supplier.create({
    data: {
      name: "TechSupply Ltda",
      cnpj: "98.765.432/0001-00",
      email: "vendas@techsupply.com",
      phone: "(11) 3000-9999",
    },
  })

  const [catElet, catPap, catInfo] = await Promise.all([
    prisma.productCategory.create({ data: { name: "Eletrônicos", color: "#6366f1" } }),
    prisma.productCategory.create({ data: { name: "Papelaria", color: "#f59e0b" } }),
    prisma.productCategory.create({ data: { name: "Informática", color: "#22c55e" } }),
  ])

  await Promise.all([
    prisma.product.create({
      data: {
        sku: "ELET-001",
        name: "Notebook Dell Inspiron 15",
        categoryId: catElet.id,
        supplierId: supplier.id,
        costPrice: 3200,
        salePrice: 4500,
        currentStock: 8,
        minStock: 3,
        maxStock: 20,
      },
    }),
    prisma.product.create({
      data: {
        sku: "ELET-002",
        name: "Mouse Wireless Logitech",
        categoryId: catElet.id,
        supplierId: supplier.id,
        costPrice: 80,
        salePrice: 149,
        currentStock: 0, // ZERADO
        minStock: 5,
        maxStock: 50,
      },
    }),
    prisma.product.create({
      data: {
        sku: "PAP-001",
        name: "Resma de Papel A4",
        categoryId: catPap.id,
        costPrice: 18,
        salePrice: 35,
        currentStock: 2, // ABAIXO DO MÍNIMO
        minStock: 10,
        maxStock: 100,
        unit: "pacote",
      },
    }),
    prisma.product.create({
      data: {
        sku: "PAP-002",
        name: "Caneta BIC Azul (cx 50un)",
        categoryId: catPap.id,
        costPrice: 25,
        salePrice: 45,
        currentStock: 15,
        minStock: 5,
        maxStock: 60,
        unit: "cx",
      },
    }),
    prisma.product.create({
      data: {
        sku: "INFO-001",
        name: "Teclado Mecânico RGB",
        categoryId: catInfo.id,
        supplierId: supplier.id,
        costPrice: 250,
        salePrice: 399,
        currentStock: 6,
        minStock: 2,
        maxStock: 15,
      },
    }),
    prisma.product.create({
      data: {
        sku: "INFO-002",
        name: "Monitor LED 24\" Full HD",
        categoryId: catInfo.id,
        supplierId: supplier.id,
        costPrice: 700,
        salePrice: 1099,
        currentStock: 4,
        minStock: 2,
        maxStock: 10,
      },
    }),
  ])

  // ─── Requisições ──────────────────────────────────────────────────────────
  await Promise.all([
    prisma.requisition.create({
      data: {
        title: "Compra de 10 notebooks para a equipe",
        description: "Equipe de vendas precisa de notebooks para trabalho remoto.",
        category: "PURCHASE",
        status: "OPEN",
        priority: "HIGH",
        userId: vendedora1.id,
        votes: 7,
      },
    }),
    prisma.requisition.create({
      data: {
        title: "Melhoria no módulo de relatórios",
        description: "Adicionar exportação em Excel e filtros avançados.",
        category: "SYSTEM_IMPROVEMENT",
        status: "IN_REVIEW",
        priority: "MEDIUM",
        userId: gestor.id,
        votes: 3,
      },
    }),
    prisma.requisition.create({
      data: {
        title: "Upgrade do servidor de arquivos",
        description: "Servidor atual está com 95% de capacidade.",
        category: "INFRASTRUCTURE",
        status: "APPROVED",
        priority: "CRITICAL",
        userId: lider.id,
        votes: 12,
      },
    }),
  ])

  // ─── Notifications ────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId: owner.id,
        type: "STOCK_ZERO",
        title: "Estoque zerado",
        message: 'Produto "Mouse Wireless Logitech" está com estoque zerado.',
        link: "/estoque",
      },
      {
        userId: owner.id,
        type: "STOCK_MIN",
        title: "Estoque mínimo atingido",
        message: 'Produto "Resma de Papel A4" atingiu o estoque mínimo (2 pacotes).',
        link: "/estoque",
      },
      {
        userId: owner.id,
        type: "REQUISITION_UPDATE",
        title: "Requisição aprovada",
        message: 'A requisição "Upgrade do servidor de arquivos" foi aprovada.',
        link: "/requisicoes",
      },
    ],
  })

  console.log("\n✅ Seed concluído!\n")
  console.log("Usuários criados:")
  console.log("  📧 dono@empresa.com       | OWNER")
  console.log("  📧 lider@empresa.com      | HEAD_LEADER")
  console.log("  📧 gestor@empresa.com     | MANAGER")
  console.log("  📧 vendedora1@empresa.com | SELLER (Ana Silva)")
  console.log("  📧 vendedora2@empresa.com | SELLER (Carla Santos)")
  console.log("\n  🔑 Senha de todos: senha123")
  console.log("\n  🌐 Acesse: http://localhost:3000\n")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
