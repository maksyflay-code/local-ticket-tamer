export type MaterialSelecionado = { item_id: string; quantidade: number };

export function validarMateriais(materiais: MaterialSelecionado[], saldos: Map<string, number>): string | null {
  if (materiais.length === 0) return "Selecione ao menos um material";
  const totais = new Map<string, number>();
  for (const m of materiais) {
    if (!m.item_id || !Number.isSafeInteger(m.quantidade) || m.quantidade <= 0) return "Informe quantidades inteiras maiores que zero";
    totais.set(m.item_id, (totais.get(m.item_id) ?? 0) + m.quantidade);
  }
  for (const [id, total] of totais) {
    const saldo = saldos.get(id);
    if (saldo === undefined) return "Material não encontrado";
    if (total > saldo) return "Quantidade maior que o saldo disponível";
  }
  return null;
}