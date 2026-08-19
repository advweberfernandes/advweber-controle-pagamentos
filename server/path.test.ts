import { describe, expect, it } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import { apiPath, appPath, APP_BASE_PATH } from "../client/src/lib/app-path";

describe("path and cookie helpers", () => {
  it("normalizes root or configured APP_BASE_PATH correctly", () => {
    expect(typeof APP_BASE_PATH).toBe("string");
    expect(APP_BASE_PATH.endsWith("/")).toBe(false);
  });

  it("builds app paths without duplicating leading slashes", () => {
    const rootPath = appPath("/");
    expect(rootPath.includes("//")).toBe(false);

    const clientPath = appPath("/clientes/4200001");
    expect(clientPath.includes("//")).toBe(false);
    expect(clientPath.endsWith("/clientes/4200001")).toBe(true);
  });

  it("builds api paths properly for tRPC and backend endpoints", () => {
    const trpcPath = apiPath("/trpc");
    expect(trpcPath.includes("//")).toBe(false);
    expect(trpcPath.endsWith("/api/trpc")).toBe(true);
  });

  it("uses the isolated legacy cookie name pagamentos_legacy_session_id", () => {
    expect(COOKIE_NAME).toBe("pagamentos_legacy_session_id");
  });

  it("ensures asset requests under subpaths or assets folder do not fall back to index.html HTML MIME", () => {
    const assetPath = "/plataformas/pagamentos/assets/index-BsV0KU_p.js";
    expect(assetPath.includes("/assets/")).toBe(true);
  });

  it("strips %VITE_ANALYTICS_ENDPOINT% placeholder when unconfigured", () => {
    const rawHtml = '<script defer src="%VITE_ANALYTICS_ENDPOINT%/umami" data-website-id="%VITE_ANALYTICS_WEBSITE_ID%"></script>';
    const cleaned = rawHtml.replace(/<script\s+defer\s+src="%VITE_ANALYTICS_ENDPOINT%\/umami"[\s\S]*?<\/script>/gi, "");
    expect(cleaned.includes("%VITE_ANALYTICS_ENDPOINT%")).toBe(false);
  });
});

