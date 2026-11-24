import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const os = "00000000-0000-4000-8000-000000000010";
const operacao = "00000000-0000-4000-8000-000000000020";
let db: PGlite;
let caixa: string;

async function saldo() {
  const { rows } = await db.query<{ quantidade: number }>("SELECT quantidade FROM public.estoque_itens WHERE id = $1", [caixa]);
  return rows[0]?.quantidade;
}
async function baixar(qtd: number, extras: Record<string, unknown> = {}) {
  return db.query<{ total: number }>("SELECT public.registrar_materiais_os($1, $2, $3::jsonb, 'Reparo em campo') AS total", [
    os, operacao, JSON.stringify([{ item_id: caixa, quantidade: qtd, ...extras }]),
  ]);
}
async function identity(user = owner) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec("SET ROLE authenticated");
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE anon;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    INSERT INTO auth.users VALUES ('${owner}', 'operator@example.invalid'), ('${other}', 'viewer@example.invalid');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
    CREATE FUNCTION public.can_write(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT _user_id = '${owner}'::uuid $$;
    CREATE FUNCTION public.can_read(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT _user_id IS NOT NULL $$;
    CREATE TYPE public.solicitacao_tipo AS ENUM ('transito','rfo','compras','manutencao','acesso','reembolso','veiculo','cotacao');
    CREATE TABLE public.solicitacoes(id uuid PRIMARY KEY, numero integer, status text);
    INSERT INTO public.solicitacoes VALUES ('${os}', 123, 'em_andamento');
    CREATE TABLE public.solicitacao_historico(id uuid DEFAULT gen_random_uuid(), solicitacao_id uuid, tipo text, descricao text, autor text, created_at timestamptz DEFAULT now());
  `);
  await db.exec(readFileSync(new URL("../../supabase/migrations/20261124150000_estoque.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("./20261124160000_solicitacoes_b2b.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("./20261124161000_materiais_os.sql", import.meta.url), "utf8"));
  const { rows } = await db.query<{ id: string }>("SELECT id FROM public.estoque_itens WHERE nome = 'CAIXA DE EMENDA'");
  const item = rows[0];
  if (!item) throw new Error("Caixa inicial ausente");
  caixa = item.id;
});
afterEach(async () => { await db.close(); });

describe("migrações locais e consumo de materiais", () => {
  it("instala os 8 materiais e inicia CAIXA DE EMENDA com 18", async () => {
    const { rows } = await db.query<{ total: number }>("SELECT count(*)::integer AS total FROM public.estoque_itens");
    expect(rows[0]?.total).toBe(8); expect(await saldo()).toBe(18);
  });
  it("instala os tipos B2B oferecidos pela IVI", async () => {
    const { rows } = await db.query<{ valor: string }>("SELECT unnest(enum_range(NULL::public.solicitacao_tipo))::text AS valor");
    expect(rows.map((r) => r.valor)).toEqual(expect.arrayContaining(["ativacao", "ampliacao", "reparo_fibra", "configuracao_bgp", "conexao_ptt", "colocation", "protecao_ddos"]));
  });
  it("baixa 2 de 18, vincula à OS e salva o autor da sessão, ignorando outro proprietário", async () => {
    await identity();
    await baixar(2, { user_id: other });
    expect(await saldo()).toBe(16);
    const { rows } = await db.query<{ user_id: string; solicitacao_id: string; quantidade: number }>("SELECT user_id, solicitacao_id, quantidade FROM public.estoque_movimentos");
    expect(rows[0]).toEqual({ user_id: owner, solicitacao_id: os, quantidade: 2 });
    await db.exec("RESET ROLE");
    const history = await db.query<{ total: number }>("SELECT count(*)::integer AS total FROM public.solicitacao_historico WHERE tipo = 'material'");
    expect(history.rows[0]?.total).toBe(1);
  });
  it("repetir a mesma operação não gera baixa dupla", async () => {
    await identity(); await baixar(2); await baixar(2);
    expect(await saldo()).toBe(16);
    const { rows } = await db.query<{ total: number }>("SELECT count(*)::integer AS total FROM public.estoque_movimentos");
    expect(rows[0]?.total).toBe(1);
  });
  it("uma saída de 19 falha e mantém as 18 caixas e histórico vazio", async () => {
    await identity(); await expect(baixar(19)).rejects.toThrow(/Estoque insuficiente/);
    expect(await saldo()).toBe(18);
    await db.exec("RESET ROLE");
    const { rows } = await db.query<{ total: number }>("SELECT count(*)::integer AS total FROM public.solicitacao_historico");
    expect(rows[0]?.total).toBe(0);
  });
  it("falha no segundo material reverte também a primeira baixa", async () => {
    const second = await db.query<{ id: string }>("SELECT id FROM public.estoque_itens WHERE nome = 'OLHAL'");
    const olhal = second.rows[0]; if (!olhal) throw new Error("OLHAL ausente");
    await identity();
    await expect(db.query("SELECT public.registrar_materiais_os($1,$2,$3::jsonb)", [os, operacao, JSON.stringify([
      { item_id: caixa, quantidade: 2 }, { item_id: olhal.id, quantidade: 1 },
    ])])).rejects.toThrow(/Estoque insuficiente/);
    expect(await saldo()).toBe(18);
  });
  it("visualizador não pode baixar materiais", async () => {
    await identity(other); await expect(baixar(2)).rejects.toThrow(/Sem permissão/); expect(await saldo()).toBe(18);
  });
  it("requisição sem sessão não pode baixar materiais", async () => {
    await expect(baixar(2)).rejects.toThrow(/Sem permissão/); expect(await saldo()).toBe(18);
  });
  it("uma OS concluída não pode consumir novos materiais", async () => {
    await db.query("UPDATE public.solicitacoes SET status = 'concluida' WHERE id = $1", [os]);
    await identity(); await expect(baixar(2)).rejects.toThrow(/OS encerrada/); expect(await saldo()).toBe(18);
  });
  it("a saída manual também usa o proprietário da sessão", async () => {
    await identity();
    await db.query("INSERT INTO public.estoque_movimentos(item_id, tipo, quantidade, user_id) VALUES ($1,'saida',2,$2)", [caixa, other]);
    const { rows } = await db.query<{ user_id: string }>("SELECT user_id FROM public.estoque_movimentos");
    expect(rows[0]?.user_id).toBe(owner); expect(await saldo()).toBe(16);
  });
  it("não permite forjar uma baixa vinculada à OS fora da função", async () => {
    await identity();
    await expect(db.query("INSERT INTO public.estoque_movimentos(item_id,tipo,quantidade,solicitacao_id) VALUES ($1,'saida',2,$2)", [caixa, os])).rejects.toThrow(/row-level security/);
    expect(await saldo()).toBe(18);
  });
  it("não permite excluir material com movimentação vinculada", async () => {
    await identity(); await baixar(2);
    await expect(db.query("DELETE FROM public.estoque_itens WHERE id=$1", [caixa])).rejects.toThrow(/foreign key/);
    expect(await saldo()).toBe(16);
  });
});