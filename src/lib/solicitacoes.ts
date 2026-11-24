import type { LucideIcon } from "lucide-react";
import {
  Network,
  FileText,
  ShoppingCart,
  Wrench,
  KeyRound,
  Receipt,
  Car,
  FileSpreadsheet,
} from "lucide-react";

export type SolicitacaoTipo =
  | "transito"
  | "rfo"
  | "compras"
  | "manutencao"
  | "acesso"
  | "reembolso"
  | "veiculo"
  | "cotacao"
  | "ativacao" | "ampliacao" | "reparo_fibra" | "configuracao_bgp"
  | "conexao_ptt" | "colocation" | "protecao_ddos";

export type SolicitacaoStatus =
  | "aberta"
  | "em_andamento"
  | "concluida"
  | "cancelada";

export type TipoMeta = {
  value: SolicitacaoTipo;
  label: string;
  short: string;
  icon: LucideIcon;
  color: string;
  description: string;
};

export const TIPOS: TipoMeta[] = [
  { value: "ativacao", label: "Ativação de circuito B2B", short: "Ativação", icon: Network, color: "text-primary", description: "Trânsito IP, transporte de dados ou link dedicado" },
  { value: "ampliacao", label: "Ampliação de capacidade", short: "Ampliação", icon: Network, color: "text-primary", description: "Upgrade de banda e portas do provedor" },
  { value: "reparo_fibra", label: "Reparo de fibra / backbone", short: "Reparo de fibra", icon: Wrench, color: "text-destructive", description: "Rompimento, fusão, caixas de emenda e rede óptica" },
  { value: "configuracao_bgp", label: "Configuração BGP / IP", short: "BGP / IP", icon: Network, color: "text-primary", description: "ASN, anúncios IPv4/IPv6 e políticas de roteamento" },
  { value: "conexao_ptt", label: "Conexão ao PTT / IX.br", short: "PTT / IX.br", icon: Network, color: "text-primary", description: "Ativação de VLAN, porta e peering no PIX" },
  { value: "colocation", label: "Colocation / intervenção no POP", short: "Colocation", icon: Wrench, color: "text-primary", description: "Instalação de equipamento, rack e cross-connect" },
  { value: "protecao_ddos", label: "Proteção / mitigação DDoS", short: "DDoS", icon: Network, color: "text-destructive", description: "Ativação de proteção e tratamento de ataques" },
  {
    value: "transito",
    label: "Solicitação de Trânsito",
    short: "Trânsito",
    icon: Network,
    color: "text-sky-400",
    description: "Solicitar autorização de trânsito (VTAL etc.)",
  },
  {
    value: "rfo",
    label: "Geração de RFO",
    short: "RFO",
    icon: FileText,
    color: "text-violet-400",
    description: "Relatório Final de Ocorrência",
  },
  {
    value: "compras",
    label: "Solicitação de Compras",
    short: "Compras",
    icon: ShoppingCart,
    color: "text-amber-400",
    description: "Pedir compra de materiais, equipamentos ou ferramentas",
  },
  {
    value: "manutencao",
    label: "Manutenção Programada",
    short: "Manutenção",
    icon: Wrench,
    color: "text-orange-400",
    description: "Janela de manutenção em equipamento ou POP",
  },
  {
    value: "acesso",
    label: "Solicitação de Acesso / Credenciais",
    short: "Acesso",
    icon: KeyRound,
    color: "text-emerald-400",
    description: "Criação de usuário, VPN ou acesso a sistemas",
  },
  {
    value: "reembolso",
    label: "Solicitação de Reembolso",
    short: "Reembolso",
    icon: Receipt,
    color: "text-pink-400",
    description: "Despesas de campo (combustível, alimentação, outros)",
  },
  {
    value: "veiculo",
    label: "Solicitação de Veículo / Frota",
    short: "Veículo",
    icon: Car,
    color: "text-cyan-400",
    description: "Reserva de veículo da empresa",
  },
  {
    value: "cotacao",
    label: "Cotação / Orçamento",
    short: "Cotação",
    icon: FileSpreadsheet,
    color: "text-lime-400",
    description: "Solicitar cotação de preços a fornecedores",
  },
];

export const TIPOS_MAP: Record<SolicitacaoTipo, TipoMeta> = TIPOS.reduce(
  (acc, t) => {
    acc[t.value] = t;
    return acc;
  },
  {} as Record<SolicitacaoTipo, TipoMeta>,
);

export const STATUS_META: Record<
  SolicitacaoStatus,
  { label: string; cls: string }
> = {
  aberta: {
    label: "Aberta",
    cls: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  em_andamento: {
    label: "Em andamento",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  concluida: {
    label: "Concluída",
    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  cancelada: {
    label: "Cancelada",
    cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  },
};

export type CampoDef = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "datetime-local" | "select";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  rows?: number;
  min?: number;
  step?: string;
};

/** Campos específicos (jsonb dados) por tipo. */
export const TIPOS_B2B: SolicitacaoTipo[] = ["ativacao", "ampliacao", "reparo_fibra", "configuracao_bgp", "conexao_ptt", "colocation", "protecao_ddos"];
const servicos = [
  { value: "transito_ip", label: "Trânsito IP" }, { value: "transporte_dados", label: "Transporte de Dados" },
  { value: "link_dedicado", label: "Link Dedicado" },
];
const circuito: CampoDef = { name: "circuito", label: "Circuito / contrato", type: "text", required: true };
const contato: CampoDef = { name: "contato_tecnico", label: "Contato técnico do provedor", type: "text", required: true };
const local: CampoDef = { name: "local", label: "POP / endereço / trecho", type: "text", required: true };
export const CAMPOS_POR_TIPO: Record<SolicitacaoTipo, CampoDef[]> = {
  ativacao: [
    { name: "servico", label: "Serviço", type: "select", required: true, options: servicos }, contato,
    { name: "origem", label: "Ponta A / POP de origem", type: "text", required: true },
    { name: "destino", label: "Ponta B / endereço de entrega", type: "text", required: true },
    { name: "capacidade", label: "Capacidade contratada", type: "text", required: true, placeholder: "10 Gbps" },
    { name: "vlan", label: "VLAN / interface", type: "text" },
    { name: "prazo", label: "Prazo de ativação", type: "date", required: true },
  ],
  ampliacao: [circuito, contato, local,
    { name: "banda_atual", label: "Capacidade atual", type: "text", required: true },
    { name: "banda_nova", label: "Nova capacidade", type: "text", required: true },
    { name: "janela", label: "Janela de alteração", type: "datetime-local", required: true },
  ],
  reparo_fibra: [circuito, contato, local,
    { name: "ocorrencia", label: "Ocorrência / chamado relacionado", type: "text", required: true },
    { name: "impacto", label: "Circuitos e provedores afetados", type: "textarea", required: true },
    { name: "equipe", label: "Equipe / técnico em campo", type: "text" },
    { name: "servico_executado", label: "Serviço a executar", type: "textarea", required: true },
  ],
  configuracao_bgp: [circuito, contato,
    { name: "asn", label: "ASN do provedor", type: "text", required: true },
    { name: "prefixos", label: "Prefixos IPv4 / IPv6", type: "textarea", required: true },
    { name: "alteracao", label: "Alteração de roteamento solicitada", type: "textarea", required: true },
    { name: "janela", label: "Janela prevista", type: "datetime-local" },
  ],
  conexao_ptt: [contato,
    { name: "asn", label: "ASN do provedor", type: "text", required: true },
    { name: "pix", label: "PTT / PIX de destino", type: "text", required: true },
    { name: "capacidade", label: "Capacidade da porta", type: "text", required: true },
    { name: "vlan", label: "VLAN / cross-connect", type: "text" },
    { name: "prazo", label: "Prazo desejado", type: "date" },
  ],
  colocation: [contato, local,
    { name: "atividade", label: "Atividade", type: "select", required: true, options: [
      { value: "instalacao", label: "Instalação" }, { value: "retirada", label: "Retirada" },
      { value: "cross_connect", label: "Cross-connect" }, { value: "intervencao", label: "Intervenção técnica" },
    ] },
    { name: "rack", label: "Rack / posição / unidades U", type: "text", required: true },
    { name: "equipamento", label: "Equipamento / serial", type: "text", required: true },
    { name: "janela", label: "Janela de acesso", type: "datetime-local", required: true },
  ],
  protecao_ddos: [contato,
    { name: "asn", label: "ASN do provedor", type: "text" },
    { name: "prefixos", label: "Prefixos / IPs protegidos", type: "textarea", required: true },
    { name: "acao", label: "Ação", type: "select", required: true, options: [
      { value: "ativacao", label: "Ativar proteção" }, { value: "mitigacao", label: "Mitigar ataque" },
      { value: "ajuste", label: "Ajustar filtros / política" },
    ] },
    { name: "detalhes", label: "Sintomas / tráfego / evidências", type: "textarea", required: true },
  ],
  transito: [
    { name: "origem", label: "Origem", type: "text", required: true, placeholder: "POP / endereço de origem" },
    { name: "destino", label: "Destino", type: "text", required: true, placeholder: "POP / endereço de destino" },
    { name: "data_prevista", label: "Data prevista", type: "date", required: true },
    { name: "responsavel_campo", label: "Responsável em campo", type: "text" },
    { name: "observacoes", label: "Observações", type: "textarea", rows: 4 },
  ],
  rfo: [
    { name: "ocorrencia", label: "Ocorrência / Incidente", type: "text", required: true },
    { name: "inicio", label: "Início", type: "datetime-local", required: true },
    { name: "fim", label: "Fim", type: "datetime-local", required: true },
    { name: "causa_raiz", label: "Causa raiz", type: "textarea", required: true, rows: 4 },
    { name: "acoes_tomadas", label: "Ações tomadas", type: "textarea", required: true, rows: 4 },
    { name: "acoes_preventivas", label: "Ações preventivas", type: "textarea", rows: 3 },
  ],
  compras: [
    { name: "itens", label: "Itens (um por linha)", type: "textarea", required: true, rows: 5, placeholder: "Ex.: 10x patch cord 2m\n2x switch Datacom" },
    { name: "fornecedor", label: "Fornecedor sugerido", type: "text" },
    { name: "valor_estimado", label: "Valor estimado (R$)", type: "number", min: 0, step: "0.01" },
    { name: "urgencia", label: "Urgência", type: "select", options: [
      { value: "normal", label: "Normal" },
      { value: "alta", label: "Alta" },
      { value: "critica", label: "Crítica" },
    ]},
    { name: "justificativa", label: "Justificativa", type: "textarea", required: true, rows: 3 },
  ],
  manutencao: [
    { name: "alvo", label: "Equipamento / POP", type: "text", required: true },
    { name: "janela_inicio", label: "Início da janela", type: "datetime-local", required: true },
    { name: "janela_fim", label: "Fim da janela", type: "datetime-local", required: true },
    { name: "impacto", label: "Impacto previsto", type: "textarea", required: true, rows: 3, placeholder: "Clientes/serviços afetados, downtime esperado" },
    { name: "plano", label: "Plano de execução", type: "textarea", required: true, rows: 4 },
    { name: "rollback", label: "Plano de rollback", type: "textarea", required: true, rows: 3 },
  ],
  acesso: [
    { name: "usuario", label: "Usuário / pessoa", type: "text", required: true },
    { name: "sistema", label: "Sistema / recurso", type: "text", required: true, placeholder: "VPN, Mikrotik, Zabbix, e-mail..." },
    { name: "tipo_acesso", label: "Tipo de acesso", type: "select", required: true, options: [
      { value: "leitura", label: "Leitura" },
      { value: "escrita", label: "Leitura + escrita" },
      { value: "admin", label: "Administrativo" },
    ]},
    { name: "prazo", label: "Prazo necessário", type: "date" },
    { name: "motivo", label: "Motivo", type: "textarea", required: true, rows: 3 },
  ],
  reembolso: [
    { name: "categoria", label: "Categoria", type: "select", required: true, options: [
      { value: "combustivel", label: "Combustível" },
      { value: "alimentacao", label: "Alimentação" },
      { value: "pedagio", label: "Pedágio" },
      { value: "hospedagem", label: "Hospedagem" },
      { value: "outros", label: "Outros" },
    ]},
    { name: "data_despesa", label: "Data da despesa", type: "date", required: true },
    { name: "valor", label: "Valor (R$)", type: "number", required: true, min: 0, step: "0.01" },
    { name: "descricao_despesa", label: "Descrição", type: "textarea", required: true, rows: 3 },
  ],
  veiculo: [
    { name: "veiculo", label: "Veículo desejado", type: "text", placeholder: "Placa / modelo (deixe em branco para qualquer)" },
    { name: "retirada", label: "Retirada", type: "datetime-local", required: true },
    { name: "devolucao", label: "Devolução", type: "datetime-local", required: true },
    { name: "destino", label: "Destino", type: "text", required: true },
    { name: "motivo", label: "Motivo", type: "textarea", required: true, rows: 3 },
  ],
  cotacao: [
    { name: "cliente_nome", label: "Cliente / prospect", type: "text", required: true, placeholder: "Razão social ou nome" },
    { name: "cliente_contato", label: "Contato (nome / e-mail / telefone)", type: "text", required: true },
    { name: "servico", label: "Serviço solicitado", type: "select", required: true, options: [
      { value: "transito_ip", label: "Trânsito IP" },
      { value: "transporte_dados", label: "Transporte de Dados" },
      { value: "link_dedicado", label: "Link Dedicado" },
      { value: "colocation", label: "Colocation" },
      { value: "ptt", label: "Conexão ao PTT" },
      { value: "ddos", label: "Proteção DDoS" },
      { value: "outro", label: "Outro / combinado" },
    ]},
    { name: "capacidade", label: "Capacidade / banda", type: "text", placeholder: "Ex.: 10 Gbps, 1U, /29 IPv4" },
    { name: "endereco_instalacao", label: "Endereço de instalação / POP", type: "text", required: true },
    { name: "prazo_ativacao", label: "Prazo desejado de ativação", type: "date" },
    { name: "sla", label: "SLA / disponibilidade desejada", type: "text", placeholder: "Ex.: 99,9%" },
    { name: "concorrencia", label: "Concorrência / valor praticado hoje", type: "text", placeholder: "Operadora atual e valor, se houver" },
    { name: "detalhes", label: "Detalhes técnicos / observações", type: "textarea", required: true, rows: 4 },
  ],
};

export function defaultTituloForTipo(tipo: SolicitacaoTipo, dados: Record<string, unknown>): string {
  const meta = TIPOS_MAP[tipo];
  switch (tipo) {
    case "ativacao": case "ampliacao": case "reparo_fibra": case "configuracao_bgp":
    case "conexao_ptt": case "colocation": case "protecao_ddos":
      return `${meta.short} — ${dados.cliente_nome ?? "provedor"}${dados.circuito ? ` · ${dados.circuito}` : ""}`;
    case "transito":
      return `Trânsito ${dados.origem ?? "?"} → ${dados.destino ?? "?"}`;
    case "rfo":
      return `RFO — ${dados.ocorrencia ?? "ocorrência"}`;
    case "compras":
      return `Compras — ${(dados.itens as string | undefined)?.split("\n")[0]?.slice(0, 60) ?? "itens"}`;
    case "manutencao":
      return `Manutenção — ${dados.alvo ?? "alvo"}`;
    case "acesso":
      return `Acesso ${dados.tipo_acesso ?? ""} — ${dados.sistema ?? ""}`.trim();
    case "reembolso":
      return `Reembolso ${dados.categoria ?? ""} — R$ ${dados.valor ?? "0"}`;
    case "veiculo":
      return `Veículo — ${dados.destino ?? "destino"}`;
    case "cotacao":
      return `Cotação ${dados.servico ?? ""} — ${dados.cliente_nome ?? "cliente"}`.trim();
    default:
      return meta.label;
  }
}