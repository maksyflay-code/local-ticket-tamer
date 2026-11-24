import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

let root: string;
const first = "20260505113646_base.sql";
const stock = "20261124150000_estoque.sql";
const b2b = "20261124160000_solicitacoes_b2b.sql";
const materials = "20261124161000_materiais_os.sql";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ivi-migrations-"));
  for (const dir of ["scripts", "bin", "docker/init", "docker/migrations", "supabase/migrations"]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  copyFileSync(new URL("./apply-migrations.sh", import.meta.url), join(root, "scripts/apply-migrations.sh"));
  writeFileSync(join(root, "docker/.env"), "POSTGRES_PASSWORD=test-only\n");
  writeFileSync(join(root, "docker/init/01-auth-functions.sql"), "SELECT 1;\n");
  writeFileSync(join(root, "applied"), "");
  writeFileSync(join(root, "attempted"), "");
  for (const [dir, name] of [["supabase", first], ["supabase", stock], ["docker", b2b], ["docker", materials]]) {
    writeFileSync(join(root, `${dir}/migrations/${name}`), `-- fixture: ${name}\nSELECT 1;\n`);
  }
  // docker exec -T forwards and drains stdin even when psql receives a -c query.
  writeFileSync(join(root, "bin/docker"), `#!/usr/bin/env bash
set -euo pipefail
input="$(cat)"
args="$*"
if [[ "$args" == *"SELECT 1 FROM public._migracoes_aplicadas"* ]]; then
  name="$(printf '%s' "$args" | sed -n "s/.*WHERE nome = '\\([^']*\\)'.*/\\1/p")"
  if grep -Fxq "$name" "$FIXTURE_ROOT/applied"; then printf '1\\n'; fi
elif [[ "$args" == *"--single-transaction"* ]]; then
  name="$(printf '%s' "$input" | sed -n "s/.*VALUES ('\\([^']*\\)').*/\\1/p")"
  printf '%s\\n' "$name" >> "$FIXTURE_ROOT/attempted"
  if [[ "$name" == "\${FAIL_MIGRATION:-}" ]]; then exit 32; fi
  printf '%s\\n' "$name" >> "$FIXTURE_ROOT/applied"
elif [[ "$input" == *"REVOKE UPDATE, DELETE ON public.estoque_movimentos"* ]]; then
  for name in ${stock} ${b2b} ${materials}; do
    if ! grep -Fxq "$name" "$FIXTURE_ROOT/applied"; then
      echo 'ERROR: relation public.estoque_movimentos does not exist' >&2
      exit 1
    fi
  done
fi
`);
  chmodSync(join(root, "bin/docker"), 0o755);
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

function run(fail = "") {
  return spawnSync("bash", [join(root, "scripts/apply-migrations.sh")], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${join(root, "bin")}:${process.env["PATH"] ?? ""}`, FIXTURE_ROOT: root, FAIL_MIGRATION: fail },
  });
}
function attempted() {
  return readFileSync(join(root, "attempted"), "utf8").trim().split("\n").filter(Boolean);
}

it("applies both directories in timestamp order when the first migration is already applied", () => {
  writeFileSync(join(root, "applied"), `${first}\n`);
  const result = run();
  expect(attempted()).toEqual([stock, b2b, materials]);
  expect(result.status, result.stderr).toBe(0);
  expect(run().status).toBe(0);
  expect(attempted()).toEqual([stock, b2b, materials]);
});

it("applies every migration on a fresh installation", () => {
  const result = run();
  expect(attempted()).toEqual([first, stock, b2b, materials]);
  expect(result.status, result.stderr).toBe(0);
});

it("stops on a SQL failure without marking it as applied or executing dependent migrations", () => {
  const result = run(stock);
  expect(result.status).toBe(32);
  expect(attempted()).toEqual([first, stock]);
  expect(readFileSync(join(root, "applied"), "utf8")).toBe(`${first}\n`);
});