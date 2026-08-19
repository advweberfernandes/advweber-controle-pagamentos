import { describe, expect, it, vi } from "vitest";
import { authenticateViaAuthCore } from "./_core/sdk";
import type { Request } from "express";

describe("Auth Core & Admin Rule Integration Unit Tests", () => {
  it("1. returns null (UNAUTHORIZED) when app_session_id cookie is missing", async () => {
    const mockReq = { headers: {} } as Request;
    const user = await authenticateViaAuthCore(mockReq);
    expect(user).toBeNull();
  });

  it("2. returns null (UNAUTHORIZED) when Auth Core returns 401 for invalid cookie", async () => {
    const mockReq = { headers: { cookie: "app_session_id=invalid_token" } } as Request;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ authenticated: false, error: "Nao autenticado (401)" }),
    }));

    const user = await authenticateViaAuthCore(mockReq);
    expect(user).toBeNull();
    vi.unstubAllGlobals();
  });

  it("3. fail-closed when Auth Core times out", async () => {
    const mockReq = { headers: { cookie: "app_session_id=valid_token" } } as Request;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise((_, reject) => {
      const err = new Error("AbortError");
      err.name = "AbortError";
      reject(err);
    })));

    const user = await authenticateViaAuthCore(mockReq);
    expect(user).toBeNull();
    vi.unstubAllGlobals();
  });

  it("4. fail-closed on network error", async () => {
    const mockReq = { headers: { cookie: "app_session_id=valid_token" } } as Request;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));

    const user = await authenticateViaAuthCore(mockReq);
    expect(user).toBeNull();
    vi.unstubAllGlobals();
  });

  it("5. fail-closed when Auth Core returns invalid JSON", async () => {
    const mockReq = { headers: { cookie: "app_session_id=valid_token" } } as Request;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError("Unexpected token"); },
    }));

    const user = await authenticateViaAuthCore(mockReq);
    expect(user).toBeNull();
    vi.unstubAllGlobals();
  });

  it("6. denies access (FORBIDDEN/null) when authenticated=true but role is 'user'", async () => {
    const mockReq = { headers: { cookie: "app_session_id=user_token" } } as Request;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: { id: 2, name: "Common User", role: "user" },
        permissions: { pagamentos: true, admin: false },
      }),
    }));

    const user = await authenticateViaAuthCore(mockReq);
    expect(user).toBeNull();
    vi.unstubAllGlobals();
  });

  it("7. denies access when role is missing in Auth Core response", async () => {
    const mockReq = { headers: { cookie: "app_session_id=norole_token" } } as Request;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: { id: 3, name: "No Role User" },
      }),
    }));

    const user = await authenticateViaAuthCore(mockReq);
    expect(user).toBeNull();
    vi.unstubAllGlobals();
  });

  it("8. denies access when role is unknown (e.g. 'editor' or 'manager')", async () => {
    const mockReq = { headers: { cookie: "app_session_id=custom_token" } } as Request;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: { id: 4, name: "Manager User", role: "manager" },
      }),
    }));

    const user = await authenticateViaAuthCore(mockReq);
    expect(user).toBeNull();
    vi.unstubAllGlobals();
  });

  it("9. allows access when role is strictly 'admin'", async () => {
    const mockReq = { headers: { cookie: "app_session_id=admin_token" } } as Request;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: { id: 1, name: "Admin User", role: "admin" },
        permissions: { pagamentos: true, admin: true },
      }),
    }));

    const user = await authenticateViaAuthCore(mockReq);
    expect(user).not.toBeNull();
    expect(user?.role).toBe("admin");
    expect(user?.isAdmin).toBe(true);
    vi.unstubAllGlobals();
  });

  it("10. denies access when permissions.admin=true but user.role!='admin'", async () => {
    const mockReq = { headers: { cookie: "app_session_id=fake_admin_token" } } as Request;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: { id: 5, name: "Regular User", role: "user" },
        permissions: { pagamentos: true, admin: true },
      }),
    }));

    const user = await authenticateViaAuthCore(mockReq);
    expect(user).toBeNull();
    vi.unstubAllGlobals();
  });

  it("11. forwards ONLY app_session_id to Auth Core and filters other cookies", async () => {
    const mockReq = {
      headers: { cookie: "app_session_id=secret123; pagamentos_legacy_session_id=legacy456; other_cookie=xyz" }
    } as Request;

    let sentCookieHeader = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, init) => {
      sentCookieHeader = init.headers.cookie;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ authenticated: true, user: { id: 1, role: "admin" } }),
      });
    }));

    await authenticateViaAuthCore(mockReq);
    expect(sentCookieHeader).toBe("app_session_id=secret123");
    expect(sentCookieHeader.includes("pagamentos_legacy_session_id")).toBe(false);
    expect(sentCookieHeader.includes("other_cookie")).toBe(false);
    vi.unstubAllGlobals();
  });
});
