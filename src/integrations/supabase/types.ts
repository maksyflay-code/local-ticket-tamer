export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chamado_anexos: {
        Row: {
          chamado_id: string
          created_at: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho: number | null
        }
        Insert: {
          chamado_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho?: number | null
        }
        Update: {
          chamado_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chamado_anexos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      chamado_historico: {
        Row: {
          autor: string | null
          chamado_id: string
          created_at: string
          descricao: string
          id: string
          status_anterior: string | null
          status_novo: string | null
          tipo: string
        }
        Insert: {
          autor?: string | null
          chamado_id: string
          created_at?: string
          descricao: string
          id?: string
          status_anterior?: string | null
          status_novo?: string | null
          tipo?: string
        }
        Update: {
          autor?: string | null
          chamado_id?: string
          created_at?: string
          descricao?: string
          id?: string
          status_anterior?: string | null
          status_novo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamado_historico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados: {
        Row: {
          categoria: string | null
          cliente_id: string | null
          codigo: string | null
          created_at: string
          descricao: string | null
          finalizado_at: string | null
          id: string
          iniciado_at: string | null
          numero: number
          prioridade: Database["public"]["Enums"]["chamado_prioridade"]
          resolvido_at: string | null
          responsavel_id: string | null
          sla_pausado_at: string | null
          sla_pausado_total_seg: number
          status: Database["public"]["Enums"]["chamado_status"]
          tecnico_responsavel: string | null
          tipo_problema: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          finalizado_at?: string | null
          id?: string
          iniciado_at?: string | null
          numero?: number
          prioridade?: Database["public"]["Enums"]["chamado_prioridade"]
          resolvido_at?: string | null
          responsavel_id?: string | null
          sla_pausado_at?: string | null
          sla_pausado_total_seg?: number
          status?: Database["public"]["Enums"]["chamado_status"]
          tecnico_responsavel?: string | null
          tipo_problema?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          finalizado_at?: string | null
          id?: string
          iniciado_at?: string | null
          numero?: number
          prioridade?: Database["public"]["Enums"]["chamado_prioridade"]
          resolvido_at?: string | null
          responsavel_id?: string | null
          sla_pausado_at?: string | null
          sla_pausado_total_seg?: number
          status?: Database["public"]["Enums"]["chamado_status"]
          tecnico_responsavel?: string | null
          tipo_problema?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cidade: string | null
          created_at: string
          data_contrato: string | null
          documento: string | null
          email: string | null
          endereco: string | null
          id: string
          ip: string | null
          nome: string
          observacoes: string | null
          plano: string | null
          plano_id: string | null
          status: Database["public"]["Enums"]["cliente_status"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          data_contrato?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          ip?: string | null
          nome: string
          observacoes?: string | null
          plano?: string | null
          plano_id?: string | null
          status?: Database["public"]["Enums"]["cliente_status"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          data_contrato?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          ip?: string | null
          nome?: string
          observacoes?: string | null
          plano?: string | null
          plano_id?: string | null
          status?: Database["public"]["Enums"]["cliente_status"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_gerados: {
        Row: {
          autor_email: string | null
          chamado_id: string | null
          cliente_id: string | null
          created_at: string
          criado_por: string | null
          dados: Json
          id: string
          storage_path: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          autor_email?: string | null
          chamado_id?: string | null
          cliente_id?: string | null
          created_at?: string
          criado_por?: string | null
          dados?: Json
          id?: string
          storage_path?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          autor_email?: string | null
          chamado_id?: string | null
          cliente_id?: string | null
          created_at?: string
          criado_por?: string | null
          dados?: Json
          id?: string
          storage_path?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_gerados_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_gerados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos: {
        Row: {
          ativo: boolean
          created_at: string
          fabricante: string
          hostname: string
          id: string
          ipv4: string
          observacoes: string | null
          pop: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          fabricante?: string
          hostname: string
          id?: string
          ipv4: string
          observacoes?: string | null
          pop?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          fabricante?: string
          hostname?: string
          id?: string
          ipv4?: string
          observacoes?: string | null
          pop?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      manutencoes_programadas: {
        Row: {
          antecedencia_min: number
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          id: string
          notificado_antes_at: string | null
          notificado_inicio_at: string | null
          notificar_telegram: boolean
          operadora: string
          trecho: string
          updated_at: string
        }
        Insert: {
          antecedencia_min?: number
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          id?: string
          notificado_antes_at?: string | null
          notificado_inicio_at?: string | null
          notificar_telegram?: boolean
          operadora: string
          trecho: string
          updated_at?: string
        }
        Update: {
          antecedencia_min?: number
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          notificado_antes_at?: string | null
          notificado_inicio_at?: string | null
          notificar_telegram?: boolean
          operadora?: string
          trecho?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          notify_finalizacao: boolean
          notify_relato: boolean
          notify_status: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notify_finalizacao?: boolean
          notify_relato?: boolean
          notify_status?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          notify_finalizacao?: boolean
          notify_relato?: boolean
          notify_status?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          historico_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          historico_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          historico_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          preco: number
          tipo: string
          updated_at: string
          velocidade_download: number | null
          velocidade_upload: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          preco?: number
          tipo?: string
          updated_at?: string
          velocidade_download?: number | null
          velocidade_upload?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          preco?: number
          tipo?: string
          updated_at?: string
          velocidade_download?: number | null
          velocidade_upload?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      server_function_failures: {
        Row: {
          app_version: string | null
          build_id: string | null
          build_time: string | null
          client_timestamp: string | null
          created_at: string
          deploy_url: string | null
          function_name: string | null
          id: string
          message: string
          metadata: Json
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          build_id?: string | null
          build_time?: string | null
          client_timestamp?: string | null
          created_at?: string
          deploy_url?: string | null
          function_name?: string | null
          id?: string
          message: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          build_id?: string | null
          build_time?: string | null
          client_timestamp?: string | null
          created_at?: string
          deploy_url?: string | null
          function_name?: string | null
          id?: string
          message?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sla_config: {
        Row: {
          horas_resolucao: number
          horas_resposta: number | null
          prioridade: string
          updated_at: string
        }
        Insert: {
          horas_resolucao: number
          horas_resposta?: number | null
          prioridade: string
          updated_at?: string
        }
        Update: {
          horas_resolucao?: number
          horas_resposta?: number | null
          prioridade?: string
          updated_at?: string
        }
        Relationships: []
      }
      solicitacao_historico: {
        Row: {
          autor: string | null
          created_at: string
          descricao: string
          id: string
          solicitacao_id: string
          status_anterior: string | null
          status_novo: string | null
          tipo: string
        }
        Insert: {
          autor?: string | null
          created_at?: string
          descricao: string
          id?: string
          solicitacao_id: string
          status_anterior?: string | null
          status_novo?: string | null
          tipo?: string
        }
        Update: {
          autor?: string | null
          created_at?: string
          descricao?: string
          id?: string
          solicitacao_id?: string
          status_anterior?: string | null
          status_novo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_historico_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes: {
        Row: {
          cancelada_at: string | null
          chamado_id: string | null
          cliente_id: string | null
          concluida_at: string | null
          created_at: string
          dados: Json
          descricao: string | null
          documento_id: string | null
          id: string
          iniciada_at: string | null
          numero: number
          prioridade: string
          responsavel_id: string | null
          responsavel_nome: string | null
          solicitante_email: string | null
          solicitante_id: string | null
          status: Database["public"]["Enums"]["solicitacao_status"]
          tipo: Database["public"]["Enums"]["solicitacao_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          cancelada_at?: string | null
          chamado_id?: string | null
          cliente_id?: string | null
          concluida_at?: string | null
          created_at?: string
          dados?: Json
          descricao?: string | null
          documento_id?: string | null
          id?: string
          iniciada_at?: string | null
          numero?: number
          prioridade?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          solicitante_email?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["solicitacao_status"]
          tipo: Database["public"]["Enums"]["solicitacao_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          cancelada_at?: string | null
          chamado_id?: string | null
          cliente_id?: string | null
          concluida_at?: string | null
          created_at?: string
          dados?: Json
          descricao?: string | null
          documento_id?: string | null
          id?: string
          iniciada_at?: string | null
          numero?: number
          prioridade?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          solicitante_email?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["solicitacao_status"]
          tipo?: Database["public"]["Enums"]["solicitacao_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read: { Args: { _user_id: string }; Returns: boolean }
      can_write: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operador" | "visualizador"
      chamado_prioridade: "baixa" | "media" | "alta" | "urgente"
      chamado_status:
        | "aberto"
        | "em_andamento"
        | "aguardando_cliente"
        | "resolvido"
        | "fechado"
      cliente_status: "ativo" | "inativo" | "suspenso"
      solicitacao_status: "aberta" | "em_andamento" | "concluida" | "cancelada"
      solicitacao_tipo:
        | "transito"
        | "rfo"
        | "compras"
        | "manutencao"
        | "acesso"
        | "reembolso"
        | "veiculo"
        | "cotacao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operador", "visualizador"],
      chamado_prioridade: ["baixa", "media", "alta", "urgente"],
      chamado_status: [
        "aberto",
        "em_andamento",
        "aguardando_cliente",
        "resolvido",
        "fechado",
      ],
      cliente_status: ["ativo", "inativo", "suspenso"],
      solicitacao_status: ["aberta", "em_andamento", "concluida", "cancelada"],
      solicitacao_tipo: [
        "transito",
        "rfo",
        "compras",
        "manutencao",
        "acesso",
        "reembolso",
        "veiculo",
        "cotacao",
      ],
    },
  },
} as const
