/**
 * Shared helpers for the demo-grade admin gate.
 *
 * Imported by both `proxy.ts` (cookie check) and `lib/admin-actions.ts`
 * (login/logout server actions).
 *
 * The password comes from the server-only `ADMIN_PASSWORD` env var (never
 * committed). The cookie stores a SHA-256 digest of it, not the password
 * itself. If the env var is missing, the gate fails closed.
 */
export const ADMIN_COOKIE_NAME = "admin_auth";

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function adminSessionToken(): Promise<string | null> {
  const password = process.env.ADMIN_PASSWORD;
  return password ? sha256Hex(`ship-it-shop-admin:${password}`) : null;
}

export async function isAdminPassword(candidate: string) {
  const password = process.env.ADMIN_PASSWORD;
  return Boolean(password) && candidate === password;
}
