import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  listClients,
  getClientById,
  createClient,
  createClientAndGetId,
  deleteClient,
  updateClient,
  deleteInstallmentsByClientId,
  createInstallments,
  getInstallmentsByClientId,
  markInstallmentPaid,
  markInstallmentUnpaid,
  updateInstallmentDueDate,
  updateInstallmentValue,
  getAllInstallmentsWithClients,
  syncOverdueInstallments,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  clients: router({
    list: publicProcedure.query(async () => {
      await syncOverdueInstallments();
      return listClients();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        await syncOverdueInstallments();
        const client = await getClientById(input.id);
        if (!client) return null;
        const installments = await getInstallmentsByClientId(input.id);
        return { ...client, installments };
      }),

    create: publicProcedure
      .input(
        z.object({
          name: z.string().min(1, "Nome é obrigatório"),
          totalFees: z.number().positive("Valor total deve ser positivo"),
          installmentCount: z.number().int().min(1).max(120),
          installmentValue: z.number().positive("Valor da parcela deve ser positivo"),
          startDate: z.number(), // UTC timestamp ms da primeira parcela
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Inserir cliente e obter ID via insertId
        const insertResult = await createClientAndGetId({
          name: input.name,
          totalFees: String(input.totalFees),
          installmentCount: input.installmentCount,
          installmentValue: String(input.installmentValue),
          startDate: input.startDate,
          notes: input.notes ?? null,
        });
        const newClientId = insertResult;
        const newClient = await getClientById(newClientId);
        if (!newClient) throw new Error("Falha ao criar cliente");

        const now = Date.now();

        // Gerar parcelas automaticamente
        const installmentsData = Array.from({ length: input.installmentCount }, (_, i) => {
          // Calcular data de vencimento: startDate + i meses
          const dueDate = new Date(input.startDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          const dueDateMs = dueDate.getTime();
          const status: "pending" | "overdue" = dueDateMs < now ? "overdue" : "pending";
          return {
            clientId: newClient.id,
            number: i + 1,
            dueDate: dueDateMs,
            paidAt: null,
            status,
          };
        });

        await createInstallments(installmentsData);
        return newClient;
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteClient(input.id);
        return { success: true };
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          totalFees: z.number().positive().optional(),
          installmentCount: z.number().int().min(1).max(120).optional(),
          installmentValue: z.number().positive().optional(),
          startDate: z.number().optional(),
          notes: z.string().nullable().optional(),
          regenerateInstallments: z.boolean().optional(), // se true, recria todas as parcelas
        })
      )
      .mutation(async ({ input }) => {
        const { id, regenerateInstallments, ...fields } = input;
        const updateData: Parameters<typeof updateClient>[1] = {};
        if (fields.name !== undefined) updateData.name = fields.name;
        if (fields.totalFees !== undefined) updateData.totalFees = String(fields.totalFees);
        if (fields.installmentCount !== undefined) updateData.installmentCount = fields.installmentCount;
        if (fields.installmentValue !== undefined) updateData.installmentValue = String(fields.installmentValue);
        if (fields.startDate !== undefined) updateData.startDate = fields.startDate;
        if (fields.notes !== undefined) updateData.notes = fields.notes;

        await updateClient(id, updateData);

        if (regenerateInstallments) {
          // Buscar dados atualizados do cliente
          const client = await getClientById(id);
          if (!client) throw new Error("Cliente não encontrado");
          // Remover parcelas antigas e recriar
          await deleteInstallmentsByClientId(id);
          const now = Date.now();
          const installmentsData = Array.from({ length: client.installmentCount }, (_, i) => {
            const dueDate = new Date(client.startDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            const dueDateMs = dueDate.getTime();
            const status: "pending" | "overdue" = dueDateMs < now ? "overdue" : "pending";
            return { clientId: id, number: i + 1, dueDate: dueDateMs, paidAt: null, status };
          });
          await createInstallments(installmentsData);
        }

        return { success: true };
      }),
  }),

  installments: router({
    markPaid: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const paidAt = Date.now();
        await markInstallmentPaid(input.id, paidAt);
        return { success: true, paidAt };
      }),

    markUnpaid: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await markInstallmentUnpaid(input.id);
        return { success: true };
      }),

    carne: publicProcedure.query(async () => {
      await syncOverdueInstallments();
      return getAllInstallmentsWithClients();
    }),

    updateDueDate: publicProcedure
      .input(z.object({ id: z.number(), dueDate: z.number() }))
      .mutation(async ({ input }) => {
        await updateInstallmentDueDate(input.id, input.dueDate);
        return { success: true };
      }),

    updateValue: publicProcedure
      .input(z.object({ id: z.number(), value: z.number().positive() }))
      .mutation(async ({ input }) => {
        await updateInstallmentValue(input.id, String(input.value));
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
