import { supabase } from "@/integrations/supabase/client";

export type DocumentoTipo = "rfo" | "transito";

function safeUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${h.slice(0,4).join("")}-${h.slice(4,6).join("")}-${h.slice(6,8).join("")}-${h.slice(8,10).join("")}-${h.slice(10,16).join("")}`;
}

export type DocumentoGerado = {
  id: string;
  tipo: DocumentoTipo;
  titulo: string;
  chamado_id: string | null;
  cliente_id: string | null;
  dados: Record<string, unknown>;
  storage_path: string | null;
  criado_por: string | null;
  autor_email: string | null;
  created_at: string;
};

/**
 * Persist a generated PDF (RFO / Trânsito VTAL) in storage and metadata table.
 * Falha silenciosamente — gera o PDF localmente de qualquer forma.
 */
export async function salvarDocumentoGerado(params: {
  tipo: DocumentoTipo;
  titulo: string;
  pdfBytes: Uint8Array | ArrayBuffer;
  dados: Record<string, unknown>;
  chamadoId?: string | null;
  clienteId?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, error: "Sem sessão" };

  const id = safeUuid();
  const path = `${params.tipo}/${id}.pdf`;

  const bytes =
    params.pdfBytes instanceof Uint8Array
      ? params.pdfBytes
      : new Uint8Array(params.pdfBytes);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });

  const up = await supabase.storage
    .from("documentos-gerados")
    .upload(path, blob, { contentType: "application/pdf", upsert: false });
  if (up.error) return { ok: false, error: up.error.message };

  const ins = await supabase.from("documentos_gerados").insert({
    id,
    tipo: params.tipo,
    titulo: params.titulo,
    chamado_id: params.chamadoId ?? null,
    cliente_id: params.clienteId ?? null,
    dados: params.dados as never,
    storage_path: path,
    criado_por: user.id,
    autor_email: user.email ?? null,
  } as never);
  if (ins.error) return { ok: false, error: ins.error.message };

  return { ok: true, id };
}

export async function listarDocumentos(tipo: DocumentoTipo): Promise<DocumentoGerado[]> {
  const { data, error } = await supabase
    .from("documentos_gerados")
    .select("*")
    .eq("tipo", tipo)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as unknown as DocumentoGerado[]) ?? [];
}

export async function gerarUrlAssinada(storagePath: string, expiresInSec = 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from("documentos-gerados")
    .createSignedUrl(storagePath, expiresInSec);
  if (error || !data?.signedUrl) throw error ?? new Error("Falha ao gerar URL");
  return data.signedUrl;
}

export async function excluirDocumento(doc: DocumentoGerado): Promise<void> {
  if (doc.storage_path) {
    await supabase.storage.from("documentos-gerados").remove([doc.storage_path]);
  }
  const { error } = await supabase.from("documentos_gerados").delete().eq("id", doc.id);
  if (error) throw error;
}