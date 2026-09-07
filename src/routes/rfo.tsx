import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { requireAuth } from "@/lib/guard";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Download, ImagePlus, X, FileText } from "lucide-react";
import jsPDF from "jspdf";
import bgUrl from "@/assets/rfo-background.jpg";
import { salvarDocumentoGerado } from "@/lib/documentos";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/rfo")({
  beforeLoad: requireAuth,
  component: RfoPage,
});

type RfoForm = {
  cliente: string;
  protocolo: string;
  data: string; // yyyy-mm-dd
  inicio: string; // HH:MM
  fim: string; // HH:MM
  trecho: string;
  descricao: string;
  solucao: string;
  localizacao: string;
  responsavel: string;
  responsavelArea: string;
  responsavelEmail: string;
};

type FotoItem = { name: string; dataUrl: string; w: number; h: number };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await fileToDataUrl(new File([blob], "logo"));
}

function formatDataBr(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatDateTimeBr(value: string): string {
  if (!value) return "—";
  // value: yyyy-mm-ddTHH:MM
  const [date, time] = value.split("T");
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}${time ? ` ${time}` : ""}`;
}

function RfoPage() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<RfoForm>({
    cliente: "",
    protocolo: "",
    data: today,
    inicio: `${today}T00:00`,
    fim: `${today}T00:00`,
    trecho: "",
    descricao: "",
    solucao: "",
    localizacao: "",
    responsavel: "",
    responsavelArea: "CSM – Central de Suporte e Monitoramento",
    responsavelEmail: user?.email ?? "",
  });
  const [fotos, setFotos] = useState<FotoItem[]>([]);
  const [generating, setGenerating] = useState(false);

  const onFotos = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const items: FotoItem[] = [];
    for (const f of arr) {
      try {
        const dataUrl = await fileToDataUrl(f);
        const { w, h } = await loadImageSize(dataUrl);
        items.push({ name: f.name, dataUrl, w, h });
      } catch {
        toast.error(`Falha ao ler ${f.name}`);
      }
    }
    setFotos((prev) => [...prev, ...items]);
  };

  const removeFoto = (i: number) => setFotos((prev) => prev.filter((_, idx) => idx !== i));

  const generate = async () => {
    if (!form.cliente.trim()) return toast.error("Informe o cliente");
    if (!form.descricao.trim()) return toast.error("Informe a descrição do evento");
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      let bgData: string | null = null;
      try { bgData = await urlToDataUrl(bgUrl); } catch { /* ignore */ }

      const drawBackground = () => {
        if (bgData) {
          try { doc.addImage(bgData, "JPEG", 0, 0, pageW, pageH, undefined, "FAST"); } catch { /* ignore */ }
        }
      };

      drawBackground();
      let y = 130; // espaço para o cabeçalho da arte

      // Título
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(20, 20, 20);
      doc.text("Reason For Outage - RFO", pageW / 2, y, { align: "center" });
      y += 16;

      // Tabela de dados
      const rows: [string, string][] = [
        ["CLIENTE", form.cliente],
        ["PROTOCOLO INTERNO", form.protocolo || "—"],
        ["DATA", formatDataBr(form.data)],
        ["INÍCIO DO EVENTO", formatDateTimeBr(form.inicio)],
        ["FIM DO EVENTO", formatDateTimeBr(form.fim)],
        ["TRECHO DO EVENTO", form.trecho || "—"],
      ];
      const labelW = 150;
      const rowH = 20;
      doc.setFontSize(9);
      rows.forEach(([k, v]) => {
        doc.setFillColor(255, 255, 255);
        doc.rect(margin, y, labelW, rowH, "F");
        doc.setFillColor(255, 255, 255);
        doc.rect(margin + labelW, y, pageW - margin * 2 - labelW, rowH, "F");
        doc.setDrawColor(225);
        doc.rect(margin, y, pageW - margin * 2, rowH);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40);
        doc.text(k, margin + 8, y + 13);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(20);
        const text = doc.splitTextToSize(v, pageW - margin * 2 - labelW - 16);
        doc.text(text, margin + labelW + 8, y + 13);
        y += rowH;
      });
      y += 10;

      const section = (title: string, body: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(20, 20, 20);
        doc.text(title, margin, y);
        y += 11;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(20);
        const lines = doc.splitTextToSize(body || "—", pageW - margin * 2);
        doc.text(lines, margin, y);
        y += lines.length * 11 + 8;
      };

      section("DESCRIÇÃO DO EVENTO:", form.descricao);
      section("SOLUÇÃO:", form.solucao);
      section("LOCALIZAÇÃO:", form.localizacao);

      // Reserva espaço do bloco "Responsável" para ancorar acima do rodapé
      const respLines = 1 + 1 + (form.responsavelArea ? 1 : 0) + (form.responsavelEmail ? 1 : 0);
      const respBlockH = respLines * 11 + 6;
      const respTop = pageH - 50 - respBlockH; // 50pt acima da barra azul/rodapé

      // Fotos (compactas, na mesma página quando possível)
      if (fotos.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(20);
        doc.text("FOTOS DO EVENTO:", margin, y);
        y += 14;
        const cols = fotos.length === 1 ? 1 : fotos.length === 2 ? 2 : 3;
        const gap = 8;
        const colW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
        const available = respTop - y - 8;
        const rows = Math.ceil(fotos.length / cols);
        const imgH = Math.max(120, Math.min(260, available / rows - 14));
        let col = 0;
        for (const foto of fotos) {
          if (y + imgH > respTop - 4) break;
          const x = margin + col * (colW + gap);
          try {
            const ext = foto.dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
            // Preserva proporção: caixa colW x imgH, imagem centralizada
            const ratio = foto.w / foto.h;
            const boxRatio = colW / imgH;
            let drawW = colW;
            let drawH = imgH;
            if (ratio > boxRatio) {
              drawH = colW / ratio;
            } else {
              drawW = imgH * ratio;
            }
            const dx = x + (colW - drawW) / 2;
            const dy = y + (imgH - drawH) / 2;
            doc.addImage(foto.dataUrl, ext, dx, dy, drawW, drawH, undefined, "FAST");
            doc.setDrawColor(220);
            doc.rect(dx, dy, drawW, drawH);
          } catch {
            // ignore
          }
          col++;
          if (col >= cols) { col = 0; y += imgH + 8; }
        }
      }

      // Responsável (ancorado no fim da página, acima da barra azul)
      {
        let ry = respTop;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(20);
        doc.text("Responsável pelo acompanhamento:", margin, ry); ry += 11;
        doc.setFont("helvetica", "bold");
        doc.text(form.responsavel || "—", margin, ry); ry += 11;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(20);
        if (form.responsavelArea) { doc.text(form.responsavelArea, margin, ry); ry += 11; }
        if (form.responsavelEmail) { doc.text(form.responsavelEmail, margin, ry); ry += 11; }
      }

      // Rodapé IVI + numeração de páginas
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        // linha separadora
        doc.setDrawColor(180, 180, 190);
        doc.setLineWidth(0.5);
        doc.line(margin, pageH - 36, pageW - margin, pageH - 36);
        // texto institucional centralizado
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("IVI Tecnologia e Comunicação LTDA  |  www.ivitelecom.com.br", pageW / 2, pageH - 22, { align: "center" });
        // numeração à direita
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`${i}/${pages}`, pageW - margin, pageH - 22, { align: "right" });
      }

      const filename = `RFO_${(form.cliente || "cliente").replace(/\s+/g, "_")}_${form.data.replaceAll("-", "")}.pdf`;
      doc.save(filename);
      // Persistir no Lovable Cloud
      try {
        const pdfBytes = doc.output("arraybuffer");
        const res = await salvarDocumentoGerado({
          tipo: "rfo",
          titulo: `RFO ${form.cliente || "—"} · ${formatDataBr(form.data)}`,
          pdfBytes,
          dados: { ...form, fotosCount: fotos.length },
        });
        if (res.ok) toast.success("RFO gerado e salvo no histórico");
        else {
          console.error("[RFO] falha ao salvar:", res.error);
          toast.error(`RFO gerado, mas NÃO salvo: ${res.error ?? "erro desconhecido"}`);
        }

        // Abre solicitação de registro com dados pré-preenchidos
        try {
          const ocorrencia = form.descricao.split("\n")[0].slice(0, 80) || `RFO ${form.cliente}`;
          const dadosSol = {
            // campos do schema "rfo" (para o detalhe renderizar)
            ocorrencia,
            inicio: form.inicio,
            fim: form.fim,
            causa_raiz: form.descricao,
            acoes_tomadas: form.solucao,
            acoes_preventivas: "",
            // dados brutos do formulário
            cliente: form.cliente,
            protocolo: form.protocolo,
            data: form.data,
            trecho: form.trecho,
            localizacao: form.localizacao,
            responsavel: form.responsavel,
            responsavelArea: form.responsavelArea,
            responsavelEmail: form.responsavelEmail,
            fotosCount: fotos.length,
          };
          const { data: userData } = await supabase.auth.getUser();
          const u = userData.user;
          const { data: sol, error: solErr } = await supabase
            .from("solicitacoes")
            .insert({
              tipo: "rfo",
              titulo: `RFO · ${form.cliente || "—"} · ${formatDataBr(form.data)}`,
              descricao: `RFO gerado para ${form.cliente || "—"}.`,
              solicitante_id: u?.id ?? null,
              solicitante_email: u?.email ?? null,
              documento_id: res.ok ? res.id ?? null : null,
              dados: dadosSol as never,
            } as never)
            .select("id, numero")
            .single();
          if (solErr || !sol) {
            console.error("[RFO] falha ao abrir solicitação:", solErr);
            toast.error("RFO gerado, mas falhou ao abrir solicitação", {
              description: solErr?.message,
            });
          } else {
            toast.success(`Solicitação #${sol.numero} aberta para registro`);
          }
        } catch (err) {
          console.error("[RFO] exceção ao abrir solicitação:", err);
        }
      } catch (err) {
        console.error("[RFO] exceção ao salvar:", err);
        toast.error(`RFO gerado, mas falhou ao salvar: ${err instanceof Error ? err.message : "erro"}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  const setF = <K extends keyof RfoForm>(k: K, v: RfoForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <AppShell title="Gerar RFO">
      <div className="max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            Preencha os dados do evento e gere um relatório RFO em PDF.
          </p>
        </div>

        <div className="border border-border bg-card p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Cliente *">
              <input value={form.cliente} onChange={(e) => setF("cliente", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Protocolo interno">
              <input value={form.protocolo} onChange={(e) => setF("protocolo", e.target.value)} placeholder="Ex: #1234 / CHM-000123" className={inputCls} />
            </Field>
            <Field label="Data do RFO">
              <input type="date" value={form.data} onChange={(e) => setF("data", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Início do evento (data e hora)">
              <input type="datetime-local" value={form.inicio} onChange={(e) => setF("inicio", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Fim do evento (data e hora)" className="md:col-span-2">
              <input type="datetime-local" value={form.fim} onChange={(e) => setF("fim", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Trecho do evento" className="md:col-span-2">
              <input value={form.trecho} onChange={(e) => setF("trecho", e.target.value)} placeholder="Ex: TELXIUS X THOME" className={inputCls} />
            </Field>
            <Field label="Localização" className="md:col-span-2">
              <input value={form.localizacao} onChange={(e) => setF("localizacao", e.target.value)} placeholder="Endereço, coordenadas, ID de poste…" className={inputCls} />
            </Field>
            <Field label="Descrição do evento *" className="md:col-span-2">
              <textarea rows={4} value={form.descricao} onChange={(e) => setF("descricao", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Solução" className="md:col-span-2">
              <textarea rows={4} value={form.solucao} onChange={(e) => setF("solucao", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Responsável pelo acompanhamento">
              <input value={form.responsavel} onChange={(e) => setF("responsavel", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Área / função">
              <input value={form.responsavelArea} onChange={(e) => setF("responsavelArea", e.target.value)} className={inputCls} />
            </Field>
            <Field label="E-mail do responsável" className="md:col-span-2">
              <input type="email" value={form.responsavelEmail} onChange={(e) => setF("responsavelEmail", e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">Fotos</div>
            <label className="block border border-dashed border-border bg-background hover:bg-secondary/30 cursor-pointer p-4 text-center text-xs text-muted-foreground font-mono">
              <ImagePlus className="h-4 w-4 inline mr-2" />
              Anexar fotos
              <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => { onFotos(e.target.files); e.target.value = ""; }} />
            </label>
            {fotos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                {fotos.map((f, i) => (
                  <div key={i} className="relative border border-border bg-background">
                    <img src={f.dataUrl} alt={f.name} className="w-full h-28 object-cover" />
                    <button onClick={() => removeFoto(i)} className="absolute top-1 right-1 bg-background/90 border border-border p-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                    <div className="text-[10px] font-mono px-2 py-1 truncate">{f.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              disabled={generating}
              onClick={generate}
              className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold uppercase tracking-wider flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> {generating ? "Gerando…" : "Gerar PDF"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const inputCls = "mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</label>
      {children}
    </div>
  );
}