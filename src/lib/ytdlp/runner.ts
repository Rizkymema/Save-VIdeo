import "server-only";
import { spawn, type ChildProcess } from "node:child_process";
import { env } from "@/lib/env";

export interface RunOptions {
  timeoutMs: number;
  /** Dipanggil per baris output (stdout & stderr), sudah tanpa \r/\n. */
  onLine?: (line: string, stream: "stdout" | "stderr") => void;
  /** Batas stdout yang disimpan (byte). Output `-J` bisa ratusan KB. */
  maxStdoutBytes?: number;
  signal?: AbortSignal;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  /** Hanya ekor stderr (cukup untuk pesan error). */
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  /** true bila binary tidak ditemukan / gagal dijalankan. */
  spawnError?: string;
}

export interface RunningProcess {
  child: ChildProcess;
  done: Promise<RunResult>;
  kill: () => void;
}

const STDERR_TAIL_BYTES = 64 * 1024;
const active = new Set<ChildProcess>();

/** Matikan proses beserta anak-anaknya (ffmpeg, python) — penting di Windows. */
export function killTree(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } else {
      // Dijalankan dengan detached:true → pid = process group id.
      process.kill(-child.pid, "SIGKILL");
    }
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      /* sudah mati */
    }
  }
}

let shutdownHookInstalled = false;
function installShutdownHook() {
  if (shutdownHookInstalled) return;
  shutdownHookInstalled = true;
  // Hanya "exit": sinyal SIGINT/SIGTERM sudah ditangani server Next.js (yang lalu memanggil exit).
  process.once("exit", () => {
    for (const child of active) killTree(child);
  });
}

export function activeProcessCount(): number {
  return active.size;
}

export function runYtDlp(args: string[], opts: RunOptions): RunningProcess {
  installShutdownHook();
  const { YTDLP_PATH } = env();
  const maxStdout = opts.maxStdoutBytes ?? 32 * 1024 * 1024;

  const child = spawn(YTDLP_PATH, args, {
    shell: false,
    windowsHide: true,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
  });
  active.add(child);

  let stdout = "";
  let stdoutBytes = 0;
  let stderr = "";
  let timedOut = false;
  let aborted = false;
  let spawnError: string | undefined;

  const lineBuffers = { stdout: "", stderr: "" };
  const feed = (stream: "stdout" | "stderr", chunk: string) => {
    if (!opts.onLine) return;
    lineBuffers[stream] += chunk;
    const parts = lineBuffers[stream].split(/\r\n|\n|\r/);
    lineBuffers[stream] = parts.pop() ?? "";
    for (const line of parts) if (line) opts.onLine(line, stream);
  };

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    if (stdoutBytes < maxStdout) {
      stdout += chunk;
      stdoutBytes += Buffer.byteLength(chunk);
    }
    feed("stdout", chunk);
  });
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
    if (stderr.length > STDERR_TAIL_BYTES) stderr = stderr.slice(-STDERR_TAIL_BYTES);
    feed("stderr", chunk);
  });

  const kill = () => killTree(child);
  const timer = setTimeout(() => {
    timedOut = true;
    kill();
  }, opts.timeoutMs);
  timer.unref?.();

  const onAbort = () => {
    aborted = true;
    kill();
  };
  if (opts.signal) {
    if (opts.signal.aborted) onAbort();
    else opts.signal.addEventListener("abort", onAbort, { once: true });
  }

  const done = new Promise<RunResult>((resolve) => {
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      active.delete(child);
      for (const stream of ["stdout", "stderr"] as const) {
        const rest = lineBuffers[stream];
        if (rest && opts.onLine) opts.onLine(rest, stream);
        lineBuffers[stream] = "";
      }
      resolve({ code, stdout, stderr, timedOut, aborted, spawnError });
    };
    child.once("error", (err) => {
      spawnError = err.message;
      finish(null);
    });
    child.once("close", (code) => finish(code));
  });

  return { child, done, kill };
}
