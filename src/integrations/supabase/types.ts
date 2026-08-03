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
      abandoned_carts: {
        Row: {
          cart_token: string | null
          company_id: string | null
          created_at: string
          id: string
          items: Json
          last_activity: string
          notified_at: string | null
          recovered_at: string | null
          recovery_order_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          cart_token?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          last_activity?: string
          notified_at?: string | null
          recovered_at?: string | null
          recovery_order_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          cart_token?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          last_activity?: string
          notified_at?: string | null
          recovered_at?: string | null
          recovery_order_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abandoned_carts_recovery_order_id_fkey"
            columns: ["recovery_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          city: string
          company_id: string
          complement: string | null
          country: string
          created_at: string
          district: string | null
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["address_kind"]
          label: string | null
          number: string | null
          state: string
          street: string
          updated_at: string
          zip: string
        }
        Insert: {
          city: string
          company_id: string
          complement?: string | null
          country?: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["address_kind"]
          label?: string | null
          number?: string | null
          state: string
          street: string
          updated_at?: string
          zip: string
        }
        Update: {
          city?: string
          company_id?: string
          complement?: string | null
          country?: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["address_kind"]
          label?: string | null
          number?: string | null
          state?: string
          street?: string
          updated_at?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_actions: {
        Row: {
          acao: string
          created_at: string
          executada: boolean
          executada_por: string | null
          id: string
          recommendation_id: string | null
          resultado: Json | null
        }
        Insert: {
          acao: string
          created_at?: string
          executada?: boolean
          executada_por?: string | null
          id?: string
          recommendation_id?: string | null
          resultado?: Json | null
        }
        Update: {
          acao?: string
          created_at?: string
          executada?: boolean
          executada_por?: string | null
          id?: string
          recommendation_id?: string | null
          resultado?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "ai_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_classifications: {
        Row: {
          classificacao: string
          confianca: number | null
          created_at: string
          id: string
          origem: string
          payload: Json | null
          referencia_id: string
        }
        Insert: {
          classificacao: string
          confianca?: number | null
          created_at?: string
          id?: string
          origem: string
          payload?: Json | null
          referencia_id: string
        }
        Update: {
          classificacao?: string
          confianca?: number | null
          created_at?: string
          id?: string
          origem?: string
          payload?: Json | null
          referencia_id?: string
        }
        Relationships: []
      }
      ai_predictions: {
        Row: {
          categoria: string
          confianca: number | null
          created_at: string
          id: string
          resultado: Json
        }
        Insert: {
          categoria: string
          confianca?: number | null
          created_at?: string
          id?: string
          resultado: Json
        }
        Update: {
          categoria?: string
          confianca?: number | null
          created_at?: string
          id?: string
          resultado?: Json
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          payload: Json | null
          prioridade: string
          referencia_id: string | null
          referencia_tipo: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          payload?: Json | null
          prioridade?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          payload?: Json | null
          prioridade?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          entidade: string | null
          entidade_id: string | null
          id: string
          ip_address: string | null
          payload: Json
          resultado: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip_address?: string | null
          payload?: Json
          resultado?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip_address?: string | null
          payload?: Json
          resultado?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          ativo: boolean
          banco: string | null
          cor: string
          created_at: string
          created_by: string | null
          default_cartao: boolean
          default_dinheiro: boolean
          default_pix: boolean
          id: string
          incluir_saldo_total: boolean
          nome: string
          observacao: string | null
          saldo_inicial: number
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          cor?: string
          created_at?: string
          created_by?: string | null
          default_cartao?: boolean
          default_dinheiro?: boolean
          default_pix?: boolean
          id?: string
          incluir_saldo_total?: boolean
          nome: string
          observacao?: string | null
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          cor?: string
          created_at?: string
          created_by?: string | null
          default_cartao?: boolean
          default_dinheiro?: boolean
          default_pix?: boolean
          id?: string
          incluir_saldo_total?: boolean
          nome?: string
          observacao?: string | null
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_statements: {
        Row: {
          account_id: string
          conciliado: boolean
          created_at: string
          data: string
          descricao: string
          documento: string | null
          fitid: string | null
          id: string
          imported_at: string
          imported_by: string | null
          tipo: string
          transaction_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          account_id: string
          conciliado?: boolean
          created_at?: string
          data: string
          descricao: string
          documento?: string | null
          fitid?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          tipo: string
          transaction_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          account_id?: string
          conciliado?: boolean
          created_at?: string
          data?: string
          descricao?: string
          documento?: string | null
          fitid?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          tipo?: string
          transaction_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transfers: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          from_account_id: string
          id: string
          observacao: string | null
          to_account_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string
          from_account_id: string
          id?: string
          observacao?: string | null
          to_account_id: string
          valor: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          from_account_id?: string
          id?: string
          observacao?: string | null
          to_account_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          nome: string
          status: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          nome: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          nome?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      business_metrics: {
        Row: {
          categoria: string
          created_at: string
          id: string
          metadata: Json
          nome: string
          periodo: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          id?: string
          metadata?: Json
          nome: string
          periodo?: string
          valor?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          metadata?: Json
          nome?: string
          periodo?: string
          valor?: number
        }
        Relationships: []
      }
      campaign_contacts: {
        Row: {
          campaign_id: string
          cidade: string | null
          classification:
            | Database["public"]["Enums"]["campaign_response_class"]
            | null
          company_id: string | null
          contact_name: string | null
          created_at: string
          estado: string | null
          id: string
          last_message_at: string | null
          last_response_at: string | null
          lead_id: string | null
          notes: string | null
          phone: string
          stage: Database["public"]["Enums"]["campaign_contact_stage"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          cidade?: string | null
          classification?:
            | Database["public"]["Enums"]["campaign_response_class"]
            | null
          company_id?: string | null
          contact_name?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          last_message_at?: string | null
          last_response_at?: string | null
          lead_id?: string | null
          notes?: string | null
          phone: string
          stage?: Database["public"]["Enums"]["campaign_contact_stage"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          cidade?: string | null
          classification?:
            | Database["public"]["Enums"]["campaign_response_class"]
            | null
          company_id?: string | null
          contact_name?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          last_message_at?: string | null
          last_response_at?: string | null
          lead_id?: string | null
          notes?: string | null
          phone?: string
          stage?: Database["public"]["Enums"]["campaign_contact_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "commercial_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_history: {
        Row: {
          campaign_id: string
          created_at: string
          descricao: string | null
          evento: string
          id: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          descricao?: string | null
          evento: string
          id?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          descricao?: string | null
          evento?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_history_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "commercial_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_messages: {
        Row: {
          campaign_id: string
          conteudo: string
          created_at: string
          dia_relativo: number
          enviados: number
          id: string
          scheduled_at: string | null
          status: string
          template_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          conteudo: string
          created_at?: string
          dia_relativo?: number
          enviados?: number
          id?: string
          scheduled_at?: string | null
          status?: string
          template_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          conteudo?: string
          created_at?: string
          dia_relativo?: number
          enviados?: number
          id?: string
          scheduled_at?: string | null
          status?: string
          template_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "commercial_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_responses: {
        Row: {
          campaign_id: string
          classification: Database["public"]["Enums"]["campaign_response_class"]
          contact_id: string | null
          created_at: string
          id: string
          message_id: string | null
          resposta: string | null
        }
        Insert: {
          campaign_id: string
          classification?: Database["public"]["Enums"]["campaign_response_class"]
          contact_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          resposta?: string | null
        }
        Update: {
          campaign_id?: string
          classification?: Database["public"]["Enums"]["campaign_response_class"]
          contact_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          resposta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_responses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "commercial_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "campaign_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_responses_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "campaign_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          nome: string
          parent_id: string | null
          slug: string
          status: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          nome: string
          parent_id?: string | null
          slug: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          nome?: string
          parent_id?: string | null
          slug?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_campaigns: {
        Row: {
          cidade: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          estado: string | null
          id: string
          meta_valor: number | null
          modelo: Database["public"]["Enums"]["campaign_model"]
          nome: string
          objetivo: string | null
          observacoes: string | null
          raio_km: number | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          estado?: string | null
          id?: string
          meta_valor?: number | null
          modelo?: Database["public"]["Enums"]["campaign_model"]
          nome: string
          objetivo?: string | null
          observacoes?: string | null
          raio_km?: number | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          estado?: string | null
          id?: string
          meta_valor?: number | null
          modelo?: Database["public"]["Enums"]["campaign_model"]
          nome?: string
          objetivo?: string | null
          observacoes?: string | null
          raio_km?: number | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cidade: string | null
          created_at: string
          email: string | null
          estado: string | null
          id: string
          latitude: number | null
          legal_name: string
          longitude: number | null
          owner_id: string
          phone: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["company_status"]
          tax_id: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cidade?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          legal_name: string
          longitude?: number | null
          owner_id: string
          phone: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          tax_id?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cidade?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          legal_name?: string
          longitude?: number | null
          owner_id?: string
          phone?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          tax_id?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      compatibilities: {
        Row: {
          created_at: string
          descricao: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compatibilities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compatibilities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit: {
        Row: {
          company_id: string
          disponivel: number
          id: string
          limite: number
          status: string
          updated_at: string
          utilizado: number
        }
        Insert: {
          company_id: string
          disponivel?: number
          id?: string
          limite?: number
          status?: string
          updated_at?: string
          utilizado?: number
        }
        Update: {
          company_id?: string
          disponivel?: number
          id?: string
          limite?: number
          status?: string
          updated_at?: string
          utilizado?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_documents: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          order_id: string | null
          tipo: string
          titulo: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          tipo: string
          titulo: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          tipo?: string
          titulo?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_favorites: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notifications: {
        Row: {
          categoria: string
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          read_at: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          read_at?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          read_at?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_rewards: {
        Row: {
          beneficios: Json
          cashback_acumulado: number
          cashback_disponivel: number
          created_at: string
          id: string
          nivel: string
          pontos: number
          updated_at: string
          user_id: string
        }
        Insert: {
          beneficios?: Json
          cashback_acumulado?: number
          cashback_disponivel?: number
          created_at?: string
          id?: string
          nivel?: string
          pontos?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          beneficios?: Json
          cashback_acumulado?: number
          cashback_disponivel?: number
          created_at?: string
          id?: string
          nivel?: string
          pontos?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_support: {
        Row: {
          assunto: string
          canal: string
          created_at: string
          id: string
          mensagem: string
          prioridade: string
          responded_at: string | null
          resposta: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assunto: string
          canal?: string
          created_at?: string
          id?: string
          mensagem: string
          prioridade?: string
          responded_at?: string | null
          resposta?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assunto?: string
          canal?: string
          created_at?: string
          id?: string
          mensagem?: string
          prioridade?: string
          responded_at?: string | null
          resposta?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboards: {
        Row: {
          configuracao: Json
          created_at: string
          created_by: string | null
          id: string
          is_shared: boolean
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          configuracao?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_shared?: boolean
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          configuracao?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_shared?: boolean
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          contexto: Json | null
          created_at: string
          id: string
          mensagem: string
          nivel: string
          origem: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          contexto?: Json | null
          created_at?: string
          id?: string
          mensagem: string
          nivel?: string
          origem: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          contexto?: Json | null
          created_at?: string
          id?: string
          mensagem?: string
          nivel?: string
          origem?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos: {
        Row: {
          account_id: string | null
          account_id_pessoal: string | null
          created_at: string
          created_by: string | null
          custo_pecas_periodo: number
          despesa_empresa_periodo: number | null
          despesa_viagem_periodo: number | null
          despesas_periodo: number
          id: string
          lucro_liquido: number
          observacao: string | null
          pct_reserva: number
          periodo_from: string
          periodo_to: string
          taxas_periodo: number | null
          updated_at: string
          valor_empresa_pendente: number
          valor_reserva: number
          valor_retirada: number
          valor_transferido: number
          vendas_periodo: number
        }
        Insert: {
          account_id?: string | null
          account_id_pessoal?: string | null
          created_at?: string
          created_by?: string | null
          custo_pecas_periodo?: number
          despesa_empresa_periodo?: number | null
          despesa_viagem_periodo?: number | null
          despesas_periodo?: number
          id?: string
          lucro_liquido?: number
          observacao?: string | null
          pct_reserva?: number
          periodo_from: string
          periodo_to: string
          taxas_periodo?: number | null
          updated_at?: string
          valor_empresa_pendente?: number
          valor_reserva?: number
          valor_retirada?: number
          valor_transferido?: number
          vendas_periodo?: number
        }
        Update: {
          account_id?: string | null
          account_id_pessoal?: string | null
          created_at?: string
          created_by?: string | null
          custo_pecas_periodo?: number
          despesa_empresa_periodo?: number | null
          despesa_viagem_periodo?: number | null
          despesas_periodo?: number
          id?: string
          lucro_liquido?: number
          observacao?: string | null
          pct_reserva?: number
          periodo_from?: string
          periodo_to?: string
          taxas_periodo?: number | null
          updated_at?: string
          valor_empresa_pendente?: number
          valor_reserva?: number
          valor_retirada?: number
          valor_transferido?: number
          vendas_periodo?: number
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamentos_account_id_pessoal_fkey"
            columns: ["account_id_pessoal"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          created_at: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          account_id: string | null
          categoria_id: string | null
          created_at: string
          data: string
          descricao: string
          fechamento_id: string | null
          id: string
          tipo: string
          trip_expense_id: string | null
          valor: number
        }
        Insert: {
          account_id?: string | null
          categoria_id?: string | null
          created_at?: string
          data?: string
          descricao: string
          fechamento_id?: string | null
          id?: string
          tipo: string
          trip_expense_id?: string | null
          valor?: number
        }
        Update: {
          account_id?: string | null
          categoria_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          fechamento_id?: string | null
          id?: string
          tipo?: string
          trip_expense_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_trip_expense_id_fkey"
            columns: ["trip_expense_id"]
            isOneToOne: false
            referencedRelation: "trip_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_goals: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          meta: number
          periodo: string
          referencia: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          meta?: number
          periodo: string
          referencia: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          meta?: number
          periodo?: string
          referencia?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          account_id: string | null
          antecipado: boolean
          bandeira: string | null
          company_id: string | null
          created_at: string
          descricao: string | null
          forma_pagamento: string | null
          id: string
          order_id: string | null
          pagamento: string | null
          parcela_num: number | null
          parcelas: number | null
          parcelas_total: number | null
          purchase_order_id: string | null
          status: string
          taxa_percentual: number | null
          taxas: number | null
          tipo: string
          updated_at: string
          valor: number
          valor_bruto: number | null
          vencimento: string | null
        }
        Insert: {
          account_id?: string | null
          antecipado?: boolean
          bandeira?: string | null
          company_id?: string | null
          created_at?: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          order_id?: string | null
          pagamento?: string | null
          parcela_num?: number | null
          parcelas?: number | null
          parcelas_total?: number | null
          purchase_order_id?: string | null
          status?: string
          taxa_percentual?: number | null
          taxas?: number | null
          tipo: string
          updated_at?: string
          valor?: number
          valor_bruto?: number | null
          vencimento?: string | null
        }
        Update: {
          account_id?: string | null
          antecipado?: boolean
          bandeira?: string | null
          company_id?: string | null
          created_at?: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          order_id?: string | null
          pagamento?: string | null
          parcela_num?: number | null
          parcelas?: number | null
          parcelas_total?: number | null
          purchase_order_id?: string | null
          status?: string
          taxa_percentual?: number | null
          taxas?: number | null
          tipo?: string
          updated_at?: string
          valor?: number
          valor_bruto?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_slides: {
        Row: {
          ativo: boolean
          created_at: string
          cta_label: string | null
          cta_link: string | null
          id: string
          image_url: string
          ordem: number
          subtitulo: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          cta_label?: string | null
          cta_link?: string | null
          id?: string
          image_url: string
          ordem?: number
          subtitulo?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          cta_label?: string | null
          cta_link?: string | null
          id?: string
          image_url?: string
          ordem?: number
          subtitulo?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      installment_plans: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          multiplicador: number
          parcelas: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          multiplicador?: number
          parcelas: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          multiplicador?: number
          parcelas?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory_count_items: {
        Row: {
          ajustado: boolean
          count_id: string
          created_at: string
          divergencia: number | null
          id: string
          observacao: string | null
          product_id: string
          qtd_contada: number | null
          qtd_sistema: number
          updated_at: string
        }
        Insert: {
          ajustado?: boolean
          count_id: string
          created_at?: string
          divergencia?: number | null
          id?: string
          observacao?: string | null
          product_id: string
          qtd_contada?: number | null
          qtd_sistema?: number
          updated_at?: string
        }
        Update: {
          ajustado?: boolean
          count_id?: string
          created_at?: string
          divergencia?: number | null
          id?: string
          observacao?: string | null
          product_id?: string
          qtd_contada?: number | null
          qtd_sistema?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          diferenca: number | null
          id: string
          observacoes: string | null
          product_id: string | null
          quantidade_contada: number
          quantidade_sistema: number
          tipo: string
          user_id: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          diferenca?: number | null
          id?: string
          observacoes?: string | null
          product_id?: string | null
          quantidade_contada?: number
          quantidade_sistema?: number
          tipo?: string
          user_id?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          diferenca?: number | null
          id?: string
          observacoes?: string | null
          product_id?: string | null
          quantidade_contada?: number
          quantidade_sistema?: number
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          lead_id: string
          tipo: Database["public"]["Enums"]["lead_activity_tipo"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          lead_id: string
          tipo: Database["public"]["Enums"]["lead_activity_tipo"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          lead_id?: string
          tipo?: Database["public"]["Enums"]["lead_activity_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          texto: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          texto: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          created_at: string
          etapa_anterior: Database["public"]["Enums"]["lead_status"] | null
          id: string
          lead_id: string
          nova_etapa: Database["public"]["Enums"]["lead_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          etapa_anterior?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id: string
          nova_etapa: Database["public"]["Enums"]["lead_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          etapa_anterior?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id?: string
          nova_etapa?: Database["public"]["Enums"]["lead_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          created_at: string
          created_by: string | null
          data: string | null
          descricao: string | null
          hora: string | null
          id: string
          lead_id: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["lead_task_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string | null
          descricao?: string | null
          hora?: string | null
          id?: string
          lead_id: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["lead_task_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string | null
          descricao?: string | null
          hora?: string | null
          id?: string
          lead_id?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["lead_task_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          cidade: string | null
          company_id: string | null
          contato: string
          created_at: string
          created_by: string | null
          email: string | null
          empresa: string
          estado: string | null
          id: string
          latitude: number | null
          longitude: number | null
          observacoes: string | null
          position: number
          responsavel_id: string | null
          score: number
          segmento: Database["public"]["Enums"]["lead_segmento"]
          status: Database["public"]["Enums"]["lead_status"]
          telefone: string | null
          ultimo_contato: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cidade?: string | null
          company_id?: string | null
          contato: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa: string
          estado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          position?: number
          responsavel_id?: string | null
          score?: number
          segmento?: Database["public"]["Enums"]["lead_segmento"]
          status?: Database["public"]["Enums"]["lead_status"]
          telefone?: string | null
          ultimo_contato?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cidade?: string | null
          company_id?: string | null
          contato?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa?: string
          estado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          position?: number
          responsavel_id?: string | null
          score?: number
          segmento?: Database["public"]["Enums"]["lead_segmento"]
          status?: Database["public"]["Enums"]["lead_status"]
          telefone?: string | null
          ultimo_contato?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_requests: {
        Row: {
          company_id: string | null
          created_at: string
          export_url: string | null
          id: string
          observacao: string | null
          processado_em: string | null
          processado_por: string | null
          requester_email: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          export_url?: string | null
          id?: string
          observacao?: string | null
          processado_em?: string | null
          processado_por?: string | null
          requester_email: string
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          export_url?: string | null
          id?: string
          observacao?: string | null
          processado_em?: string | null
          processado_por?: string | null
          requester_email?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_history: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          custo_unitario: number
          id: string
          order_id: string
          preco_final: number
          preco_unitario: number
          product_id: string
          quantidade: number
          subtotal: number
          tipo_compra: Database["public"]["Enums"]["compra_tipo"]
        }
        Insert: {
          created_at?: string
          custo_unitario?: number
          id?: string
          order_id: string
          preco_final: number
          preco_unitario: number
          product_id: string
          quantidade: number
          subtotal: number
          tipo_compra?: Database["public"]["Enums"]["compra_tipo"]
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          id?: string
          order_id?: string
          preco_final?: number
          preco_unitario?: number
          product_id?: string
          quantidade?: number
          subtotal?: number
          tipo_compra?: Database["public"]["Enums"]["compra_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          custo_lancado_em: string | null
          desconto: number
          fechamento_id: string | null
          frete: number
          id: string
          observacao: string | null
          origem: Database["public"]["Enums"]["order_origem"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          custo_lancado_em?: string | null
          desconto?: number
          fechamento_id?: string | null
          frete?: number
          id?: string
          observacao?: string | null
          origem?: Database["public"]["Enums"]["order_origem"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          custo_lancado_em?: string | null
          desconto?: number
          fechamento_id?: string | null
          frete?: number
          id?: string
          observacao?: string | null
          origem?: Database["public"]["Enums"]["order_origem"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_fees: {
        Row: {
          ativo: boolean
          bandeira: string
          created_at: string
          credito_2_6: number
          credito_7_12: number
          credito_avista: number
          debito: number | null
          id: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bandeira: string
          created_at?: string
          credito_2_6?: number
          credito_7_12?: number
          credito_avista?: number
          debito?: number | null
          id?: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bandeira?: string
          created_at?: string
          credito_2_6?: number
          credito_7_12?: number
          credito_avista?: number
          debito?: number | null
          id?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          id: string
          key: string
          label: string | null
          updated_at: string
          value: number
        }
        Insert: {
          id?: string
          key: string
          label?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          id?: string
          key?: string
          label?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          account_id: string | null
          antecipado: boolean
          bandeira: string | null
          created_at: string
          gateway: string
          id: string
          order_id: string
          payload: Json | null
          payment_link: string | null
          qr_code: string | null
          qr_code_base64: string | null
          status: Database["public"]["Enums"]["payment_status"]
          tipo: Database["public"]["Enums"]["payment_tipo"]
          transaction_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          account_id?: string | null
          antecipado?: boolean
          bandeira?: string | null
          created_at?: string
          gateway?: string
          id?: string
          order_id: string
          payload?: Json | null
          payment_link?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tipo: Database["public"]["Enums"]["payment_tipo"]
          transaction_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          account_id?: string | null
          antecipado?: boolean
          bandeira?: string | null
          created_at?: string
          gateway?: string
          id?: string
          order_id?: string
          payload?: Json | null
          payment_link?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tipo?: Database["public"]["Enums"]["payment_tipo"]
          transaction_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          acao: string
          created_at: string
          descricao: string | null
          id: string
          modulo: string
        }
        Insert: {
          acao: string
          created_at?: string
          descricao?: string | null
          id?: string
          modulo: string
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string | null
          id?: string
          modulo?: string
        }
        Relationships: []
      }
      personal_entries: {
        Row: {
          categoria: string | null
          created_at: string
          descricao: string
          fechamento_id: string | null
          id: string
          observacao: string | null
          origem: string
          pagamento: string | null
          status: string
          tipo: string
          updated_at: string
          user_id: string
          valor: number
          vencimento: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descricao: string
          fechamento_id?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          pagamento?: string | null
          status?: string
          tipo: string
          updated_at?: string
          user_id: string
          valor: number
          vencimento?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descricao?: string
          fechamento_id?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          pagamento?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_entries_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_messages: {
        Row: {
          company_id: string | null
          created_at: string
          error: string | null
          id: string
          lead_id: string | null
          message: string | null
          metadata: Json | null
          order_id: string
          phone: string | null
          send_at: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          message?: string | null
          metadata?: Json | null
          order_id: string
          phone?: string | null
          send_at: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          message?: string | null
          metadata?: Json | null
          order_id?: string
          phone?: string | null
          send_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          ordem: number
          product_id: string
          tipo_imagem: Database["public"]["Enums"]["image_tipo"]
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          ordem?: number
          product_id: string
          tipo_imagem?: Database["public"]["Enums"]["image_tipo"]
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          ordem?: number
          product_id?: string
          tipo_imagem?: Database["public"]["Enums"]["image_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
        ]
      }
      product_requests: {
        Row: {
          cidade: string | null
          cliente_nome: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          descricao: string
          id: string
          lead_id: string | null
          observacao: string | null
          prioridade: string
          product_id: string | null
          quantidade: number
          status: string
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cliente_nome?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao: string
          id?: string
          lead_id?: string | null
          observacao?: string | null
          prioridade?: string
          product_id?: string | null
          quantidade?: number
          status?: string
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cliente_nome?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string
          id?: string
          lead_id?: string | null
          observacao?: string | null
          prioridade?: string
          product_id?: string | null
          quantidade?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          categoria_id: string | null
          codigo_fabricante: string | null
          coluna: string | null
          corredor: string | null
          created_at: string
          curva_abc: string | null
          descricao_completa: string | null
          descricao_curta: string | null
          ean13: string | null
          estoque: number
          estoque_minimo: number
          frequencia: string | null
          id: string
          localizacao: string | null
          marca_id: string | null
          modelo: string | null
          nome: string
          observacoes_tecnicas: string | null
          posicao: string | null
          prateleira: string | null
          preco_custo: number | null
          preco_nivel_1: number | null
          preco_nivel_2: number | null
          preco_nivel_3: number | null
          preco_pacote: number | null
          preco_unitario: number
          quantidade_botoes: number | null
          quantidade_pacote: number
          sku: string
          status: boolean
          tipo: Database["public"]["Enums"]["product_tipo"] | null
          updated_at: string
        }
        Insert: {
          categoria_id?: string | null
          codigo_fabricante?: string | null
          coluna?: string | null
          corredor?: string | null
          created_at?: string
          curva_abc?: string | null
          descricao_completa?: string | null
          descricao_curta?: string | null
          ean13?: string | null
          estoque?: number
          estoque_minimo?: number
          frequencia?: string | null
          id?: string
          localizacao?: string | null
          marca_id?: string | null
          modelo?: string | null
          nome: string
          observacoes_tecnicas?: string | null
          posicao?: string | null
          prateleira?: string | null
          preco_custo?: number | null
          preco_nivel_1?: number | null
          preco_nivel_2?: number | null
          preco_nivel_3?: number | null
          preco_pacote?: number | null
          preco_unitario?: number
          quantidade_botoes?: number | null
          quantidade_pacote?: number
          sku: string
          status?: boolean
          tipo?: Database["public"]["Enums"]["product_tipo"] | null
          updated_at?: string
        }
        Update: {
          categoria_id?: string | null
          codigo_fabricante?: string | null
          coluna?: string | null
          corredor?: string | null
          created_at?: string
          curva_abc?: string | null
          descricao_completa?: string | null
          descricao_curta?: string | null
          ean13?: string | null
          estoque?: number
          estoque_minimo?: number
          frequencia?: string | null
          id?: string
          localizacao?: string | null
          marca_id?: string | null
          modelo?: string | null
          nome?: string
          observacoes_tecnicas?: string | null
          posicao?: string | null
          prateleira?: string | null
          preco_custo?: number | null
          preco_nivel_1?: number | null
          preco_nivel_2?: number | null
          preco_nivel_3?: number | null
          preco_pacote?: number | null
          preco_unitario?: number
          quantidade_botoes?: number | null
          quantidade_pacote?: number
          sku?: string
          status?: boolean
          tipo?: Database["public"]["Enums"]["product_tipo"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          ativo: boolean
          created_at: string
          desconto_percentual: number | null
          descricao: string | null
          id: string
          imagem_url: string | null
          link_url: string | null
          ordem: number
          titulo: string
          updated_at: string
          valido_ate: string | null
          valido_de: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          desconto_percentual?: number | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          link_url?: string | null
          ordem?: number
          titulo: string
          updated_at?: string
          valido_ate?: string | null
          valido_de?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          desconto_percentual?: number | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          link_url?: string | null
          ordem?: number
          titulo?: string
          updated_at?: string
          valido_ate?: string | null
          valido_de?: string | null
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          purchase_order_id: string
          quantidade: number
          quantidade_recebida: number | null
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          purchase_order_id: string
          quantidade?: number
          quantidade_recebida?: number | null
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          purchase_order_id?: string
          quantidade?: number
          quantidade_recebida?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          data_emissao: string
          data_recebimento: string | null
          id: string
          observacoes: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_recebimento?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_recebimento?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          enviados: number
          falhas: number
          id: string
          imagem_url: string | null
          link_url: string | null
          mensagem: string
          scheduled_at: string | null
          segmento: string
          segmento_valor: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["push_campaign_status"]
          titulo: string
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enviados?: number
          falhas?: number
          id?: string
          imagem_url?: string | null
          link_url?: string | null
          mensagem: string
          scheduled_at?: string | null
          segmento?: string
          segmento_valor?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["push_campaign_status"]
          titulo: string
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enviados?: number
          falhas?: number
          id?: string
          imagem_url?: string | null
          link_url?: string | null
          mensagem?: string
          scheduled_at?: string | null
          segmento?: string
          segmento_valor?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["push_campaign_status"]
          titulo?: string
          total?: number
        }
        Relationships: []
      }
      push_deliveries: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          created_at: string
          error: string | null
          id: string
          status: string
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          status: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "push_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          filtros: Json
          id: string
          is_shared: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          created_by?: string | null
          filtros?: Json
          id?: string
          is_shared?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          filtros?: Json
          id?: string
          is_shared?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      route_execution: {
        Row: {
          created_at: string
          distancia_real: number | null
          fim: string | null
          id: string
          inicio: string | null
          route_id: string
          tempo_real: number | null
        }
        Insert: {
          created_at?: string
          distancia_real?: number | null
          fim?: string | null
          id?: string
          inicio?: string | null
          route_id: string
          tempo_real?: number | null
        }
        Update: {
          created_at?: string
          distancia_real?: number | null
          fim?: string | null
          id?: string
          inicio?: string | null
          route_id?: string
          tempo_real?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "route_execution_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "route_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      route_items: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          ordem: number
          route_id: string
          visit_id: string | null
          visitado: boolean
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          ordem?: number
          route_id: string
          visit_id?: string | null
          visitado?: boolean
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          ordem?: number
          route_id?: string
          visit_id?: string | null
          visitado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "route_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_items_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "route_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      route_metrics: {
        Row: {
          created_at: string
          id: string
          pedidos: number
          route_id: string
          valor_vendido: number
          visitas: number
        }
        Insert: {
          created_at?: string
          id?: string
          pedidos?: number
          route_id: string
          valor_vendido?: number
          visitas?: number
        }
        Update: {
          created_at?: string
          id?: string
          pedidos?: number
          route_id?: string
          valor_vendido?: number
          visitas?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_metrics_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "route_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      route_plans: {
        Row: {
          cidade: string | null
          created_at: string
          data: string
          estado: string | null
          id: string
          nome: string
          observacoes: string | null
          status: Database["public"]["Enums"]["route_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          data?: string
          estado?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["route_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          data?: string
          estado?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["route_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mes_ref: string
          meta_qtd_pedidos: number | null
          meta_valor: number
          observacao: string | null
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mes_ref: string
          meta_qtd_pedidos?: number | null
          meta_valor?: number
          observacao?: string | null
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mes_ref?: string
          meta_qtd_pedidos?: number | null
          meta_valor?: number
          observacao?: string | null
          updated_at?: string
          vendedor_id?: string
        }
        Relationships: []
      }
      saved_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantidade: number
          saved_order_id: string
          tipo_compra: Database["public"]["Enums"]["compra_tipo"]
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantidade: number
          saved_order_id: string
          tipo_compra?: Database["public"]["Enums"]["compra_tipo"]
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantidade?: number
          saved_order_id?: string
          tipo_compra?: Database["public"]["Enums"]["compra_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "saved_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_order_items_saved_order_id_fkey"
            columns: ["saved_order_id"]
            isOneToOne: false
            referencedRelation: "saved_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          nome: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          ativo: boolean
          canal: string
          created_at: string
          created_by: string | null
          destinatarios: Json
          frequencia: string
          id: string
          last_sent_at: string | null
          report_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal: string
          created_at?: string
          created_by?: string | null
          destinatarios?: Json
          frequencia: string
          id?: string
          last_sent_at?: string | null
          report_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          created_at?: string
          created_by?: string | null
          destinatarios?: Json
          frequencia?: string
          id?: string
          last_sent_at?: string | null
          report_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_carts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          items: Json
          lead_id: string | null
          observacoes: string | null
          order_id: string | null
          status: Database["public"]["Enums"]["shared_cart_status"]
          subtotal: number
          token: string
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          items?: Json
          lead_id?: string | null
          observacoes?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["shared_cart_status"]
          subtotal?: number
          token?: string
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          items?: Json
          lead_id?: string | null
          observacoes?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["shared_cart_status"]
          subtotal?: number
          token?: string
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_carts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_carts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_carts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_carts_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          destino: string | null
          id: string
          motivo: string | null
          origem: string | null
          product_id: string | null
          quantidade: number
          reference_id: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          destino?: string | null
          id?: string
          motivo?: string | null
          origem?: string | null
          product_id?: string | null
          quantidade?: number
          reference_id?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          destino?: string | null
          id?: string
          motivo?: string | null
          origem?: string | null
          product_id?: string | null
          quantidade?: number
          reference_id?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          avaliacao: number | null
          cidade: string | null
          cnpj: string | null
          contato: string | null
          created_at: string
          email: string | null
          estado: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avaliacao?: number | null
          cidade?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avaliacao?: number | null
          cidade?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          categoria: string
          chave: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
          valor: Json
        }
        Insert: {
          categoria: string
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: Json
        }
        Update: {
          categoria?: string
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          papel: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          papel?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          papel?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          manager_id: string | null
          nome: string
          regiao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          manager_id?: string | null
          nome: string
          regiao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          manager_id?: string | null
          nome?: string
          regiao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trip_expenses: {
        Row: {
          account_id: string | null
          categoria: string
          created_at: string
          created_by: string
          data: string
          descricao: string | null
          forma_pagamento: string | null
          id: string
          receipt_path: string | null
          receipt_url: string | null
          trip_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          account_id?: string | null
          categoria: string
          created_at?: string
          created_by: string
          data?: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          receipt_path?: string | null
          receipt_url?: string | null
          trip_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          account_id?: string | null
          categoria?: string
          created_at?: string
          created_by?: string
          data?: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          receipt_path?: string | null
          receipt_url?: string | null
          trip_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          qtd_carregada: number
          qtd_devolvida: number
          qtd_vendida: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          qtd_carregada?: number
          qtd_devolvida?: number
          qtd_vendida?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          qtd_carregada?: number
          qtd_devolvida?: number
          qtd_vendida?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_below_min"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          cidade: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          destinos: Json
          estado: string | null
          id: string
          nome: string
          notas: string | null
          observacao: string | null
          opened_at: string
          status: string
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          cidade?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          destinos?: Json
          estado?: string | null
          id?: string
          nome: string
          notas?: string | null
          observacao?: string | null
          opened_at?: string
          status?: string
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          cidade?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          destinos?: Json
          estado?: string | null
          id?: string
          nome?: string
          notas?: string | null
          observacao?: string | null
          opened_at?: string
          status?: string
          updated_at?: string
          vendedor_id?: string
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
      visit_photos: {
        Row: {
          created_at: string
          file_url: string
          id: string
          legenda: string | null
          tipo: Database["public"]["Enums"]["visit_photo_tipo"]
          visit_id: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          legenda?: string | null
          tipo?: Database["public"]["Enums"]["visit_photo_tipo"]
          visit_id: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          legenda?: string | null
          tipo?: Database["public"]["Enums"]["visit_photo_tipo"]
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_photos_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_tasks: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          due_at: string | null
          id: string
          status: Database["public"]["Enums"]["visit_task_status"]
          tipo: string | null
          titulo: string
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          due_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["visit_task_status"]
          tipo?: string | null
          titulo: string
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          due_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["visit_task_status"]
          tipo?: string | null
          titulo?: string
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_tasks_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          checkin_at: string | null
          checkin_lat: number | null
          checkin_lng: number | null
          checkout_at: string | null
          checkout_lat: number | null
          checkout_lng: number | null
          company_id: string | null
          created_at: string
          duracao_min: number | null
          id: string
          lead_id: string | null
          observacoes: string | null
          resultado: Database["public"]["Enums"]["visit_resultado"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          company_id?: string | null
          created_at?: string
          duracao_min?: number | null
          id?: string
          lead_id?: string | null
          observacoes?: string | null
          resultado?: Database["public"]["Enums"]["visit_resultado"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          company_id?: string | null
          created_at?: string
          duracao_min?: number | null
          id?: string
          lead_id?: string | null
          observacoes?: string | null
          resultado?: Database["public"]["Enums"]["visit_resultado"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaign_recipients: {
        Row: {
          campaign_id: string
          company_id: string | null
          created_at: string
          error: string | null
          id: string
          lead_id: string | null
          phone: string
          sent_at: string | null
          status: Database["public"]["Enums"]["wa_message_status"]
        }
        Insert: {
          campaign_id: string
          company_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          phone: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"]
        }
        Update: {
          campaign_id?: string
          company_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          phone?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          batch_pause_minutes: number | null
          batch_size: number | null
          cidade: string | null
          created_at: string
          created_by: string | null
          estado: string | null
          id: string
          image_url: string | null
          last_batch_at: string | null
          mensagem: string
          message_interval_seconds: number | null
          nome: string
          scheduled_at: string | null
          segmento: string | null
          send_limit: number | null
          sent_at: string | null
          status: Database["public"]["Enums"]["wa_campaign_status"]
          status_filtro: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          batch_pause_minutes?: number | null
          batch_size?: number | null
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string | null
          id?: string
          image_url?: string | null
          last_batch_at?: string | null
          mensagem: string
          message_interval_seconds?: number | null
          nome: string
          scheduled_at?: string | null
          segmento?: string | null
          send_limit?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_campaign_status"]
          status_filtro?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          batch_pause_minutes?: number | null
          batch_size?: number | null
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string | null
          id?: string
          image_url?: string | null
          last_batch_at?: string | null
          mensagem?: string
          message_interval_seconds?: number | null
          nome?: string
          scheduled_at?: string | null
          segmento?: string | null
          send_limit?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_campaign_status"]
          status_filtro?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          company_id: string | null
          contact_name: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          phone: string
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          phone: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          phone?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["wa_direction"]
          external_id: string | null
          file_url: string | null
          id: string
          message_type: Database["public"]["Enums"]["wa_message_type"]
          metadata: Json | null
          sent_by: string | null
          status: Database["public"]["Enums"]["wa_message_status"]
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["wa_direction"]
          external_id?: string | null
          file_url?: string | null
          id?: string
          message_type?: Database["public"]["Enums"]["wa_message_type"]
          metadata?: Json | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"]
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["wa_direction"]
          external_id?: string | null
          file_url?: string | null
          id?: string
          message_type?: Database["public"]["Enums"]["wa_message_type"]
          metadata?: Json | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          ativo: boolean
          categoria: string
          conteudo: string
          created_at: string
          created_by: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          conteudo: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          conteudo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      workflow_actions: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          ordem: number
          parametros: Json
          tipo: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          parametros?: Json
          tipo: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          parametros?: Json
          tipo?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_actions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_conditions: {
        Row: {
          campo: string
          created_at: string
          id: string
          operador: string
          ordem: number
          updated_at: string
          valor: Json
          workflow_id: string
        }
        Insert: {
          campo: string
          created_at?: string
          id?: string
          operador: string
          ordem?: number
          updated_at?: string
          valor?: Json
          workflow_id: string
        }
        Update: {
          campo?: string
          created_at?: string
          id?: string
          operador?: string
          ordem?: number
          updated_at?: string
          valor?: Json
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_conditions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_logs: {
        Row: {
          created_at: string
          erro: string | null
          executed_at: string
          id: string
          payload: Json
          referencia_id: string | null
          referencia_tipo: string | null
          resultado: string
          trigger_tipo: string
          usuario_id: string | null
          workflow_id: string
        }
        Insert: {
          created_at?: string
          erro?: string | null
          executed_at?: string
          id?: string
          payload?: Json
          referencia_id?: string | null
          referencia_tipo?: string | null
          resultado?: string
          trigger_tipo: string
          usuario_id?: string | null
          workflow_id: string
        }
        Update: {
          created_at?: string
          erro?: string | null
          executed_at?: string
          id?: string
          payload?: Json
          referencia_id?: string | null
          referencia_tipo?: string | null
          resultado?: string
          trigger_tipo?: string
          usuario_id?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_logs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_triggers: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          parametros: Json
          tipo: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          parametros?: Json
          tipo: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          parametros?: Json
          tipo?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_triggers_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          categoria: string
          conversoes_count: number
          created_at: string
          created_by: string
          deleted_at: string | null
          descricao: string | null
          execucoes_count: number
          falhas_count: number
          id: string
          last_run_at: string | null
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          categoria?: string
          conversoes_count?: number
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          descricao?: string | null
          execucoes_count?: number
          falhas_count?: number
          id?: string
          last_run_at?: string | null
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          conversoes_count?: number
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          descricao?: string | null
          execucoes_count?: number
          falhas_count?: number
          id?: string
          last_run_at?: string | null
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      lead_funnel_metrics: {
        Row: {
          etapa: Database["public"]["Enums"]["lead_status"] | null
          quantidade: number | null
          ultimos_30_dias: number | null
        }
        Relationships: []
      }
      products_below_min: {
        Row: {
          categoria_id: string | null
          estoque: number | null
          estoque_minimo: number | null
          falta: number | null
          id: string | null
          marca_id: string | null
          nome: string | null
          sku: string | null
          status: boolean | null
        }
        Insert: {
          categoria_id?: string | null
          estoque?: number | null
          estoque_minimo?: number | null
          falta?: never
          id?: string | null
          marca_id?: string | null
          nome?: string | null
          sku?: string | null
          status?: boolean | null
        }
        Update: {
          categoria_id?: string | null
          estoque?: number | null
          estoque_minimo?: number | null
          falta?: never
          id?: string | null
          marca_id?: string | null
          nome?: string | null
          sku?: string | null
          status?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "products_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets_progress: {
        Row: {
          id: string | null
          mes_ref: string | null
          meta_qtd_pedidos: number | null
          meta_valor: number | null
          pct_atingido: number | null
          vendedor_id: string | null
          vendido_qtd: number | null
          vendido_valor: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _upper_trim: { Args: { v: string }; Returns: string }
      bank_account_balance: { Args: { _account_id: string }; Returns: number }
      crm_sync_lead_for_company: {
        Args: { _company_id: string; _created_by?: string }
        Returns: undefined
      }
      finance_kpis: {
        Args: { _from: string; _to: string }
        Returns: {
          a_pagar_total: number
          a_pagar_total_vencidas: number
          a_receber: number
          a_receber_vencidas: number
          contas_pagar: number
          contas_pagar_vencidas: number
          custo_pecas_periodo: number
          despesas_viagem_periodo: number
        }[]
      }
      generate_ean13: { Args: { _prefix?: string }; Returns: string }
      get_shared_cart: {
        Args: { _token: string }
        Returns: {
          expires_at: string
          items: Json
          observacoes: string
          status: Database["public"]["Enums"]["shared_cart_status"]
          subtotal: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inventory_apply_adjustments: {
        Args: { _count_id: string }
        Returns: number
      }
      is_manager: { Args: { _uid: string }; Returns: boolean }
      is_sales_staff: { Args: { _uid: string }; Returns: boolean }
      norm_cidade_txt: { Args: { v: string }; Returns: string }
      order_create_atomic: { Args: { _payload: Json }; Returns: string }
      pricing_tier_for_total: { Args: { _total: number }; Returns: number }
      stock_apply_delta: {
        Args: {
          _allow_negative?: boolean
          _delta: number
          _motivo: string
          _product_id: string
          _ref?: string
          _tipo: string
        }
        Returns: number
      }
      stock_deduct_open_trips: {
        Args: never
        Returns: {
          deduzido: number
          insuficientes: boolean
          product_id: string
        }[]
      }
      trip_apply_order: { Args: { _order_id: string }; Returns: undefined }
      trip_close: { Args: { _trip_id: string }; Returns: undefined }
      trip_close_v2: {
        Args: { _return_stock?: boolean; _trip_id: string }
        Returns: string
      }
      trip_load_items: {
        Args: { _items: Json; _trip_id: string }
        Returns: undefined
      }
      trip_recalculate_items: { Args: { _trip_id: string }; Returns: undefined }
      trip_record_sale: {
        Args: { _product_id: string; _quantidade: number; _trip_id: string }
        Returns: undefined
      }
    }
    Enums: {
      address_kind: "billing" | "shipping" | "both"
      app_role: "admin" | "customer" | "gerente" | "vendedor" | "operador"
      campaign_contact_stage:
        | "ENVIADA"
        | "VISUALIZADA"
        | "RESPONDEU"
        | "INTERESSADO"
        | "PRE_PEDIDO"
        | "VISITA_AGENDADA"
        | "PEDIDO"
      campaign_model:
        | "VISITA"
        | "REPOSICAO"
        | "REATIVACAO"
        | "LANCAMENTO"
        | "PROMOCAO"
        | "POS_VENDA"
      campaign_response_class:
        | "INTERESSADO"
        | "NAO_INTERESSADO"
        | "SOLICITOU_RETORNO"
        | "ORCAMENTO"
        | "VISITA"
        | "PEDIDO"
        | "SEM_RESPOSTA"
      campaign_status:
        | "RASCUNHO"
        | "AGENDADA"
        | "EM_EXECUCAO"
        | "FINALIZADA"
        | "CANCELADA"
      company_status: "pending" | "approved" | "rejected"
      compra_tipo: "UNITARIO" | "PACOTE"
      image_tipo:
        | "principal"
        | "secundaria"
        | "traseira"
        | "placa"
        | "botoes"
        | "tecnica"
      lead_activity_tipo:
        | "LIGACAO"
        | "WHATSAPP"
        | "VISITA"
        | "PROPOSTA"
        | "RETORNO"
        | "OBSERVACAO"
        | "PEDIDO"
        | "CADASTRO"
        | "MUDANCA_ETAPA"
        | "OUTRO"
      lead_segmento:
        | "CHAVEIRO"
        | "AUTO_ELETRICA"
        | "CENTRO_AUTOMOTIVO"
        | "LOJA_DE_SOM"
        | "AUTO_PECAS"
        | "INSTALADOR_DE_ALARMES"
        | "OUTRO"
      lead_status:
        | "NOVO_LEAD"
        | "CONTATO_FEITO"
        | "NEGOCIACAO"
        | "AGUARDANDO_RETORNO"
        | "CLIENTE"
        | "PERDIDO"
        | "PEDIDO"
      lead_task_status: "PENDENTE" | "CONCLUIDA" | "CANCELADA"
      order_origem: "PORTAL" | "VISITA" | "WHATSAPP"
      order_status:
        | "PENDENTE"
        | "AGUARDANDO_PAGAMENTO"
        | "PAGO"
        | "EM_SEPARACAO"
        | "ENVIADO"
        | "ENTREGUE"
        | "CANCELADO"
      payment_status:
        | "PENDENTE"
        | "APROVADO"
        | "RECUSADO"
        | "CANCELADO"
        | "ESTORNADO"
      payment_tipo: "PIX" | "CARTAO" | "DINHEIRO" | "FATURADO"
      product_tipo:
        | "controle"
        | "carcaca"
        | "alarme"
        | "modulo"
        | "transponder"
        | "lamina"
        | "bateria"
        | "acessorio"
        | "chave"
      push_campaign_status: "DRAFT" | "SENDING" | "DONE" | "FAILED"
      route_status: "PLANEJADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA"
      shared_cart_status: "PENDENTE" | "ABERTO" | "CONVERTIDO" | "EXPIRADO"
      visit_photo_tipo:
        | "FACHADA"
        | "ESTOQUE"
        | "PRODUTO"
        | "DOCUMENTO"
        | "OUTRO"
      visit_resultado:
        | "COMPROU"
        | "NEGOCIACAO"
        | "SEM_INTERESSE"
        | "RETORNAR"
        | "AUSENTE"
        | "OUTRO"
      visit_task_status: "ABERTA" | "CONCLUIDA" | "CANCELADA"
      wa_campaign_status:
        | "DRAFT"
        | "SCHEDULED"
        | "SENDING"
        | "DONE"
        | "CANCELED"
      wa_direction: "IN" | "OUT"
      wa_message_status:
        | "PENDING"
        | "SENT"
        | "DELIVERED"
        | "READ"
        | "FAILED"
        | "RECEIVED"
      wa_message_type:
        | "TEXT"
        | "IMAGE"
        | "AUDIO"
        | "VIDEO"
        | "DOCUMENT"
        | "LOCATION"
        | "CONTACT"
        | "LINK"
        | "TEMPLATE"
        | "PIX"
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
      address_kind: ["billing", "shipping", "both"],
      app_role: ["admin", "customer", "gerente", "vendedor", "operador"],
      campaign_contact_stage: [
        "ENVIADA",
        "VISUALIZADA",
        "RESPONDEU",
        "INTERESSADO",
        "PRE_PEDIDO",
        "VISITA_AGENDADA",
        "PEDIDO",
      ],
      campaign_model: [
        "VISITA",
        "REPOSICAO",
        "REATIVACAO",
        "LANCAMENTO",
        "PROMOCAO",
        "POS_VENDA",
      ],
      campaign_response_class: [
        "INTERESSADO",
        "NAO_INTERESSADO",
        "SOLICITOU_RETORNO",
        "ORCAMENTO",
        "VISITA",
        "PEDIDO",
        "SEM_RESPOSTA",
      ],
      campaign_status: [
        "RASCUNHO",
        "AGENDADA",
        "EM_EXECUCAO",
        "FINALIZADA",
        "CANCELADA",
      ],
      company_status: ["pending", "approved", "rejected"],
      compra_tipo: ["UNITARIO", "PACOTE"],
      image_tipo: [
        "principal",
        "secundaria",
        "traseira",
        "placa",
        "botoes",
        "tecnica",
      ],
      lead_activity_tipo: [
        "LIGACAO",
        "WHATSAPP",
        "VISITA",
        "PROPOSTA",
        "RETORNO",
        "OBSERVACAO",
        "PEDIDO",
        "CADASTRO",
        "MUDANCA_ETAPA",
        "OUTRO",
      ],
      lead_segmento: [
        "CHAVEIRO",
        "AUTO_ELETRICA",
        "CENTRO_AUTOMOTIVO",
        "LOJA_DE_SOM",
        "AUTO_PECAS",
        "INSTALADOR_DE_ALARMES",
        "OUTRO",
      ],
      lead_status: [
        "NOVO_LEAD",
        "CONTATO_FEITO",
        "NEGOCIACAO",
        "AGUARDANDO_RETORNO",
        "CLIENTE",
        "PERDIDO",
        "PEDIDO",
      ],
      lead_task_status: ["PENDENTE", "CONCLUIDA", "CANCELADA"],
      order_origem: ["PORTAL", "VISITA", "WHATSAPP"],
      order_status: [
        "PENDENTE",
        "AGUARDANDO_PAGAMENTO",
        "PAGO",
        "EM_SEPARACAO",
        "ENVIADO",
        "ENTREGUE",
        "CANCELADO",
      ],
      payment_status: [
        "PENDENTE",
        "APROVADO",
        "RECUSADO",
        "CANCELADO",
        "ESTORNADO",
      ],
      payment_tipo: ["PIX", "CARTAO", "DINHEIRO", "FATURADO"],
      product_tipo: [
        "controle",
        "carcaca",
        "alarme",
        "modulo",
        "transponder",
        "lamina",
        "bateria",
        "acessorio",
        "chave",
      ],
      push_campaign_status: ["DRAFT", "SENDING", "DONE", "FAILED"],
      route_status: ["PLANEJADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"],
      shared_cart_status: ["PENDENTE", "ABERTO", "CONVERTIDO", "EXPIRADO"],
      visit_photo_tipo: ["FACHADA", "ESTOQUE", "PRODUTO", "DOCUMENTO", "OUTRO"],
      visit_resultado: [
        "COMPROU",
        "NEGOCIACAO",
        "SEM_INTERESSE",
        "RETORNAR",
        "AUSENTE",
        "OUTRO",
      ],
      visit_task_status: ["ABERTA", "CONCLUIDA", "CANCELADA"],
      wa_campaign_status: ["DRAFT", "SCHEDULED", "SENDING", "DONE", "CANCELED"],
      wa_direction: ["IN", "OUT"],
      wa_message_status: [
        "PENDING",
        "SENT",
        "DELIVERED",
        "READ",
        "FAILED",
        "RECEIVED",
      ],
      wa_message_type: [
        "TEXT",
        "IMAGE",
        "AUDIO",
        "VIDEO",
        "DOCUMENT",
        "LOCATION",
        "CONTACT",
        "LINK",
        "TEMPLATE",
        "PIX",
      ],
    },
  },
} as const
