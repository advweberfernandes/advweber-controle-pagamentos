import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("uses the isolated legacy cookie name pagamentos_legacy_session_id", () => {
    expect(COOKIE_NAME).toBe("pagamentos_legacy_session_id");
  });

  it("reports success for central logout without clearing central app_session_id directly", async () => {
    const clearedCookies: CookieCall[] = [];
    const ctx: TrpcContext = {
      user: { id: 1, name: "Admin Test", role: "admin", isAdmin: true },
      req: { protocol: "https", headers: { cookie: "app_session_id=test_cookie" } } as TrpcContext["req"],
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    // Pagamentos DOES NOT clear app_session_id directly
    const clearedAppSession = clearedCookies.find(c => c.name === "app_session_id");
    expect(clearedAppSession).toBeUndefined();
  });
});


