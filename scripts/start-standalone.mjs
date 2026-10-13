// Jalankan hasil build `output: "standalone"` secara lokal (sama seperti di Docker).
// Pakai: npm run build && npm run start:standalone
import { spawn } from "node:child_process";
import { access, cp } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

try {
  await access(path.join(standalone, "server.js"));
} catch {
  console.error("✗ .next/standalone/server.js belum ada. Jalankan `npm run build` dulu.");
  process.exit(1);
}

// server.js tidak menyalin aset statis — salin seperti di Dockerfile.
await cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
await cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });

// .env.local tidak ikut ke folder standalone → muat dari root project untuk uji lokal.
nextEnv.loadEnvConfig(root, false);

const child = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  stdio: "inherit",
  env: { ...process.env, PORT: process.env.PORT ?? "3000", HOSTNAME: "0.0.0.0", NODE_ENV: "production" },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
