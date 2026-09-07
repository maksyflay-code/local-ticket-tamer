import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

async function sendTelegram(text: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID não configurado');

  // Prefer connector gateway when available, fallback to direct bot token.
  if (lovableKey && telegramKey) {
    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': telegramKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (res.ok) return;
  }
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN não configurado');
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) throw new Error(`Telegram falhou: ${res.status} ${await res.text()}`);
}

function fmt(d: string) {
  return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// Escapa caracteres que o parse_mode HTML do Telegram interpreta como tag
// (ex.: trecho "JNE<>VILA NOVA" quebrava o envio com erro 400).
function esc(v: unknown) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const Route = createFileRoute('/api/public/hooks/telegram-manutencao')({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();
        const { data: manuts, error } = await supabaseAdmin
          .from('manutencoes_programadas')
          .select('*')
          .eq('notificar_telegram', true);
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const results: any[] = [];
        for (const m of manuts ?? []) {
          const inicio = new Date(m.data_inicio as string);
          const antecedenciaMs = (m.antecedencia_min ?? 30) * 60_000;
          const avisoQuando = new Date(inicio.getTime() - antecedenciaMs);

          // Aviso prévio
          if (!m.notificado_antes_at && now >= avisoQuando && now < inicio) {
            const txt =
              `⚠️ <b>Manutenção programada em ${m.antecedencia_min ?? 30} min</b>\n` +
              `📡 <b>Operadora:</b> ${esc(m.operadora)}\n` +
              `🛣️ <b>Trecho:</b> ${esc(m.trecho)}\n` +
              `🕐 <b>Início:</b> ${fmt(m.data_inicio as string)}\n` +
              (m.data_fim ? `🏁 <b>Fim:</b> ${fmt(m.data_fim as string)}\n` : '') +
              (m.descricao ? `\n📝 ${esc(m.descricao)}` : '');
            try {
              await sendTelegram(txt);
              await supabaseAdmin
                .from('manutencoes_programadas')
                .update({ notificado_antes_at: now.toISOString() })
                .eq('id', m.id);
              results.push({ id: m.id, sent: 'antes' });
            } catch (e: any) {
              results.push({ id: m.id, error: String(e?.message ?? e) });
            }
          }

          // Início
          if (!m.notificado_inicio_at && now >= inicio) {
            const txt =
              `🔧 <b>Manutenção iniciada agora</b>\n` +
              `📡 <b>Operadora:</b> ${esc(m.operadora)}\n` +
              `🛣️ <b>Trecho:</b> ${esc(m.trecho)}\n` +
              `🕐 <b>Início:</b> ${fmt(m.data_inicio as string)}\n` +
              (m.data_fim ? `🏁 <b>Previsão fim:</b> ${fmt(m.data_fim as string)}\n` : '') +
              (m.descricao ? `\n📝 ${esc(m.descricao)}` : '');
            try {
              await sendTelegram(txt);
              await supabaseAdmin
                .from('manutencoes_programadas')
                .update({ notificado_inicio_at: now.toISOString() })
                .eq('id', m.id);
              results.push({ id: m.id, sent: 'inicio' });
            } catch (e: any) {
              results.push({ id: m.id, error: String(e?.message ?? e) });
            }
          }
        }

        return Response.json({ ok: true, checked: manuts?.length ?? 0, results });
      },
    },
  },
});