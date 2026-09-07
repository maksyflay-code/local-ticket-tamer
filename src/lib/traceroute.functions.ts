import { createServerFn } from "@tanstack/react-start";

function isValidHost(h: string) {
  return /^[a-zA-Z0-9._-]{1,253}$/.test(h);
}

async function tracerouteViaBun(host: string, maxHops: number, cmd: string[]): Promise<{ ok: boolean; output: string } | null> {
  const B = (globalThis as { Bun?: { spawn: (opts: unknown) => unknown } }).Bun;
  if (!B || typeof B.spawn !== "function") return null;
  try {
    const proc = B.spawn({
      cmd,
      stdout: "pipe",
      stderr: "pipe",
    }) as {
      stdout: ReadableStream<Uint8Array>;
      stderr: ReadableStream<Uint8Array>;
      exited: Promise<number>;
    };
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const output = (stdout || "") + (stderr ? `\n${stderr}` : "");
    return { ok: exitCode === 0, output: output.trim() || "(sem saída)" };
  } catch (e) {
    return null;
  }
}

export const tracerouteHost = createServerFn({ method: "POST" })
  .inputValidator((input: { host: string; maxHops?: number }) => {
    if (!input?.host || !isValidHost(input.host)) throw new Error("Host inválido");
    const maxHops = Math.min(Math.max(Number(input.maxHops ?? 20), 1), 30);
    return { host: input.host, maxHops };
  })
  .handler(async ({ data }) => {
    const { host, maxHops } = data;
    const candidates: string[][] = [
      ["traceroute", "-n", "-w", "2", "-q", "1", "-m", String(maxHops), host],
      ["tracepath", "-n", "-m", String(maxHops), host],
      ["mtr", "-n", "-r", "-c", "3", "-m", String(maxHops), host],
    ];
    try {
      // 1) child_process.exec (Node tradicional)
      try {
        const cp = await import("node:child_process");
        if (typeof cp.exec === "function") {
          for (const cmd of candidates) {
            const out = await new Promise<{ ok: boolean; output: string; notFound: boolean }>((resolve) => {
              cp.exec(
                cmd.join(" "),
                { timeout: 60000, maxBuffer: 131072 },
                (err: (Error & { code?: number }) | null, stdout: string, stderr: string) => {
                  const combined = (stdout || "") + (stderr || "");
                  const notFound =
                    !!err &&
                    (err.code === 127 ||
                      /not found|no such file|Executable not found/i.test(err.message + combined));
                  resolve({
                    ok: !err,
                    output: combined || (err?.message ?? "(sem saída)"),
                    notFound,
                  });
                },
              );
            });
            if (!out.notFound) {
              return { ok: out.ok, output: `$ ${cmd.join(" ")}\n\n${out.output}` };
            }
          }
          return {
            ok: false,
            output:
              `Nenhum utilitário de traceroute encontrado no servidor.\n\n` +
              `Instale um destes no seu VPS:\n` +
              `  Debian/Ubuntu:  sudo apt-get install -y traceroute\n` +
              `  Alternativas:   tracepath (pacote iputils-tracepath) ou mtr-tiny\n`,
          };
        }
      } catch {
        // segue pro Bun.spawn
      }

      // 2) Bun.spawn
      for (const cmd of candidates) {
        const r = await tracerouteViaBun(host, maxHops, cmd);
        if (r) return { ok: r.ok, output: `$ ${cmd.join(" ")}\n\n${r.output}` };
      }

      return {
        ok: false,
        output:
          `Nenhum utilitário de traceroute encontrado.\n` +
          `Instale com: sudo apt-get install -y traceroute`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, output: `Falha ao executar traceroute em ${host}.\nMotivo: ${msg}` };
    }
  });