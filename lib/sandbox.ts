/**
 * The admin agent's single persistent Vercel Sandbox. It is named, so its
 * filesystem survives between sessions (snapshotted on stop, restored on the
 * next call), and it has no network access: data goes in via `writeFiles`
 * from the app server, never by the sandbox fetching anything itself.
 *
 * Layout (relative to the sandbox working directory):
 *   memory.md     saved employee preferences / corrections / business context
 *   data/*.json   latest back-office tool results, for joins and aggregates
 *
 * Server-only. Only `lib/admin-tools.ts` and the admin workflow import this.
 */
import { Sandbox } from "@vercel/sandbox";

const SANDBOX_NAME = `ship-it-shop-admin-${process.env.VERCEL_ENV ?? "development"}`;
export const MEMORY_FILE = "memory.md";
const MAX_OUTPUT_CHARS = 12_000;

export function getAdminSandbox() {
  return Sandbox.getOrCreate({
    name: SANDBOX_NAME,
    networkPolicy: "deny-all",
    timeout: 15 * 60_000,
  });
}

export async function readMemory(): Promise<string | null> {
  const sandbox = await getAdminSandbox();
  const buf = await sandbox.readFileToBuffer({ path: MEMORY_FILE });
  return buf ? buf.toString("utf8") : null;
}

export async function appendMemory(entry: string) {
  const sandbox = await getAdminSandbox();
  const current = (await sandbox.readFileToBuffer({ path: MEMORY_FILE }))?.toString("utf8") ?? "# Admin agent memory\n";
  const next = `${current.trimEnd()}\n${entry}\n`;
  await sandbox.writeFiles([{ path: MEMORY_FILE, content: next }]);
  return next;
}

// Returns the absolute path so commands work regardless of their `cd`.
export async function saveDataFile(path: string, data: unknown) {
  const sandbox = await getAdminSandbox();
  await sandbox.writeFiles([{ path, content: JSON.stringify(data, null, 2) }]);
  return `${sandbox.cwd.replace(/\/$/, "")}/${path}`;
}

function clip(text: string) {
  return text.length > MAX_OUTPUT_CHARS
    ? { text: `${text.slice(0, MAX_OUTPUT_CHARS)}\n… [truncated ${text.length - MAX_OUTPUT_CHARS} chars]`, truncated: true }
    : { text, truncated: false };
}

export async function runBash(command: string, timeoutMs = 60_000) {
  const sandbox = await getAdminSandbox();
  const started = Date.now();
  const result = await sandbox.runCommand("bash", ["-lc", command], { timeoutMs });
  const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()]);
  const out = clip(stdout);
  const err = clip(stderr);
  return {
    command,
    exitCode: result.exitCode,
    durationMs: Date.now() - started,
    stdout: out.text,
    stderr: err.text,
    truncated: out.truncated || err.truncated,
  };
}
