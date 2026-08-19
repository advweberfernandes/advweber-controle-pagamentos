import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { authenticateViaAuthCore, type CentralAuthenticatedUser } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: CentralAuthenticatedUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: CentralAuthenticatedUser | null = null;

  try {
    user = await authenticateViaAuthCore(opts.req);
  } catch (error) {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

