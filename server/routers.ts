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
  createInstallments,
  getInstallmentsByClientId,
  markInstallmentPaid,
  markInstallmentUnpaid,
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
  }),
});

export type AppRouter = typeof appRouter;
