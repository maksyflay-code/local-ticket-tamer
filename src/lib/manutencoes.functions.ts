import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

async function sendTelegram(text: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID não configurado");

  if (lovableKey && telegramKey) {
    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": telegramKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (res.ok) return;
  }
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN não configurado");
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) throw new Error(`Telegram falhou: ${res.status}`);
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Telegram parse_mode HTML rejeita "<" e ">" soltos (ex.: trecho "JNE<>VILA NOVA").
function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const notifyManutencaoAgendada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      operadora: z.string().min(1).max(200),
      trecho: z.string().min(1).max(500),
      data_inicio: z.string().min(1),
      data_fim: z.string().nullable().optional(),
      descricao: z.string().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const txt =
      `📅 <b>Nova manutenção agendada</b>\n` +
      `📡 <b>Operadora:</b> ${esc(data.operadora)}\n` +
      `🛣️ <b>Trecho:</b> ${esc(data.trecho)}\n` +
      `🕐 <b>Início:</b> ${fmt(data.data_inicio)}\n` +
      (data.data_fim ? `🏁 <b>Fim:</b> ${fmt(data.data_fim)}\n` : "") +
      (data.descricao ? `\n📝 ${esc(data.descricao)}` : "");
    try {
      await sendTelegram(txt);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });