import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do módulo db para evitar conexão real com banco
vi.mock("./db", () => ({
  listClients: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "João da Silva",
      totalFees: "3000.00",
      installmentCount: 3,
      installmentValue: "1000.00",
      startDate: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30 dias atrás
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getClientById: vi.fn().mockResolvedValue({
    id: 1,
    name: "João da Silva",
    totalFees: "3000.00",
    installmentCount: 3,
    installmentValue: "1000.00",
    startDate: Date.now() - 1000 * 60 * 60 * 24 * 30,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  createClient: vi.fn().mockResolvedValue(undefined),
  deleteClient: vi.fn().mockResolvedValue(undefined),
  createInstallments: vi.fn().mockResolvedValue(undefined),
  getInstallmentsByClientId: vi.fn().mockResolvedValue([
    { id: 10, clientId: 1, number: 1, dueDate: Date.now() - 86400000, paidAt: null, status: "overdue" },
    { id: 11, clientId: 1, number: 2, dueDate: Date.now() + 86400000 * 30, paidAt: null, status: "pending" },
    { id: 12, clientId: 1, number: 3, dueDate: Date.now() + 86400000 * 60, paidAt: null, status: "pending" },
  ]),
  markInstallmentPaid: vi.fn().mockResolvedValue(undefined),
  markInstallmentUnpaid: vi.fn().mockResolvedValue(undefined),
  getAllInstallmentsWithClients: vi.fn().mockResolvedValue([
    {
      installmentId: 10,
      installmentNumber: 1,
      dueDate: Date.now() - 86400000,
      paidAt: null,
      status: "overdue",
      clientId: 1,
      clientName: "João da Silva",
      installmentValue: "1000.00",
    },
  ]),
  syncOverdueInstallments: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("clients.list", () => {
  it("retorna a lista de clientes", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("name", "João da Silva");
  });
});

describe("clients.getById", () => {
  it("retorna cliente com parcelas", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.getById({ id: 1 });
    expect(result).not.toBeNull();
    expect(result?.name).toBe("João da Silva");
    expect(Array.isArray(result?.installments)).toBe(true);
    expect(result?.installments.length).toBe(3);
  });
});

describe("installments.markPaid", () => {
  it("retorna sucesso e registra paidAt automaticamente", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const before = Date.now();
    const result = await caller.installments.markPaid({ id: 10 });
    const after = Date.now();
    expect(result.success).toBe(true);
    expect(result.paidAt).toBeGreaterThanOrEqual(before);
    expect(result.paidAt).toBeLessThanOrEqual(after);
  });
});

describe("installments.markUnpaid", () => {
  it("retorna sucesso ao desfazer pagamento", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.installments.markUnpaid({ id: 10 });
    expect(result.success).toBe(true);
  });
});

describe("installments.carne", () => {
  it("retorna parcelas com dados do cliente", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.installments.carne();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("clientName");
    expect(result[0]).toHaveProperty("installmentNumber");
    expect(result[0]).toHaveProperty("dueDate");
  });
});
