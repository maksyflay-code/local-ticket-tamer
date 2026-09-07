import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fanOutPush } from "./push.server";

export const triggerPushForChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        chamadoId: z.string().uuid(),
        tipo: z.enum(["finalizacao", "relato", "status"]),
        descricao: z.string().min(1).max(500),
        autorNome: z.string().min(1).max(200).default("Sistema"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: chamado } = await supabase
      .from("chamados")
      .select("codigo, numero, titulo")
      .eq("id", data.chamadoId)
      .maybeSingle();

    const label =
      chamado?.codigo ?? (chamado ? `#TK-${String(chamado.numero).padStart(4, "0")}` : "Chamado");
    const titles: Record<typeof data.tipo, string> = {
      finalizacao: `✅ ${label} finalizado`,
      relato: `💬 Novo relato em ${label}`,
      status: `🔁 ${label} — status atualizado`,
    };
    const prefKey =
      data.tipo === "finalizacao"
        ? "notify_finalizacao"
        : data.tipo === "relato"
          ? "notify_relato"
          : "notify_status";

    return fanOutPush(prefKey, {
      title: titles[data.tipo],
      body: `${data.autorNome}: ${data.descricao}${chamado?.titulo ? ` — ${chamado.titulo}` : ""}`,
      url: `/chamados?open=${data.chamadoId}`,
      tag: `chamado-${data.chamadoId}-${data.tipo}`,
    });
  });