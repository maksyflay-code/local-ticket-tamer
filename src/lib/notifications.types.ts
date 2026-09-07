export type PrefRow = {
  user_id: string;
  notify_finalizacao: boolean;
  notify_relato: boolean;
  notify_status: boolean;
  push_enabled: boolean;
};

export const DEFAULT_PREFS: Omit<PrefRow, "user_id"> = {
  notify_finalizacao: true,
  notify_relato: true,
  notify_status: true,
  push_enabled: false,
};

export type HistRow = {
  id: string;
  chamado_id: string;
  tipo: string;
  descricao: string;
  autor: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  created_at: string;
};

export type NotificationItem = HistRow & {
  read: boolean;
  chamado_codigo: string | null;
  chamado_numero: number | null;
  chamado_titulo: string | null;
};