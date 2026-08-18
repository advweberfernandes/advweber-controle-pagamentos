const rawBaseUrl = import.meta.env.BASE_URL || "/";

/**
 * Public mount point of the application, without a trailing slash.
 * Examples: "" for a root deployment and "/plataformas/pagamentos" for HML.
 */
export const APP_BASE_PATH =
  rawBaseUrl === "/" ? "" : `/${rawBaseUrl.replace(/^\/+|\/+$/g, "")}`;

/** Adds the configured application mount point to a browser path. */
export function appPath(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!APP_BASE_PATH) return normalizedPath;
  if (
    normalizedPath === APP_BASE_PATH ||
    normalizedPath.startsWith(`${APP_BASE_PATH}/`)
  ) {
    return normalizedPath;
  }

  return normalizedPath === "/"
    ? `${APP_BASE_PATH}/`
    : `${APP_BASE_PATH}${normalizedPath}`;
}
