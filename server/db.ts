import { eq, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, clients, installments, InsertClient, InsertInstallment } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Clients ────────────────────────────────────────────────────────────────

export async function listClients() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(data);
  return result[0];
}

export async function createClientAndGetId(data: InsertClient): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(data);
  // result[0].insertId é o ID gerado pelo MySQL
  const insertId = (result[0] as any).insertId as number;
  if (!insertId) throw new Error("Não foi possível obter o ID do cliente inserido");
  return insertId;
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(clients).where(eq(clients.id, id));
}

// ─── Installments ────────────────────────────────────────────────────────────

export async function createInstallments(data: InsertInstallment[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  await db.insert(installments).values(data);
}

export async function getInstallmentsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(installments)
    .where(eq(installments.clientId, clientId))
    .orderBy(asc(installments.number));
}

export async function markInstallmentPaid(id: number, paidAt: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(installments)
    .set({ paidAt, status: "paid", updatedAt: new Date() })
    .where(eq(installments.id, id));
}

export async function markInstallmentUnpaid(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  // Recompute status: overdue if dueDate < now, else pending
  const result = await db.select().from(installments).where(eq(installments.id, id)).limit(1);
  if (!result[0]) return;
  const status = result[0].dueDate < now ? "overdue" : "pending";
  await db.update(installments)
    .set({ paidAt: null, status, updatedAt: new Date() })
    .where(eq(installments.id, id));
}

export async function getAllInstallmentsWithClients() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      installmentId: installments.id,
      installmentNumber: installments.number,
      dueDate: installments.dueDate,
      paidAt: installments.paidAt,
      status: installments.status,
      clientId: clients.id,
      clientName: clients.name,
      installmentValue: clients.installmentValue,
    })
    .from(installments)
    .innerJoin(clients, eq(installments.clientId, clients.id))
    .orderBy(asc(clients.name), asc(installments.number));
  return rows;
}

export async function syncOverdueInstallments() {
  const db = await getDb();
  if (!db) return;
  const now = Date.now();
  // Buscar apenas parcelas pendentes cujo vencimento já passou
  const pending = await db.select().from(installments).where(eq(installments.status, "pending"));
  for (const inst of pending) {
    if (inst.dueDate < now) {
      await db.update(installments)
        .set({ status: "overdue", updatedAt: new Date() })
        .where(eq(installments.id, inst.id));
    }
  }
}
