import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type StockItem = { id: string; nome: string; unidade: string; quantidade: number; minimo: number; created_at: string; updated_at: string };
export type StockMovement = { id: string; item_id: string; tipo: string; quantidade: number; observacao: string | null; user_id: string | null; created_at: string; solicitacao_id: string | null; operacao_id: string | null };
type VMDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      estoque_itens: { Row: StockItem; Insert: { nome: string; minimo?: number }; Update: { nome?: string; minimo?: number }; Relationships: [] };
      estoque_movimentos: { Row: StockMovement; Insert: { item_id: string; tipo: string; quantidade: number; observacao?: string | null }; Update: never; Relationships: [] };
    };
    Functions: Database["public"]["Functions"] & {
      registrar_materiais_os: { Args: { p_solicitacao_id: string; p_operacao_id: string; p_materiais: Json; p_observacao?: string }; Returns: number };
    };
  };
};
// Extensão exclusiva do schema da VM; não modifica os tipos gerados do projeto.
export const estoqueDb = supabase as unknown as SupabaseClient<VMDatabase>;