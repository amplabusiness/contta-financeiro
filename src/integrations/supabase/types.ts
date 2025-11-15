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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounting_entries: {
        Row: {
          balanced: boolean
          created_at: string
          created_by: string
          description: string
          document_number: string | null
          entry_date: string
          entry_type: string
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          total_credit: number
          total_debit: number
        }
        Insert: {
          balanced?: boolean
          created_at?: string
          created_by: string
          description: string
          document_number?: string | null
          entry_date: string
          entry_type: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          total_credit?: number
          total_debit?: number
        }
        Update: {
          balanced?: boolean
          created_at?: string
          created_by?: string
          description?: string
          document_number?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          total_credit?: number
          total_debit?: number
        }
        Relationships: []
      }
      accounting_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          entry_id: string
          id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_id: string
          id?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entry_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_payable: {
        Row: {
          ai_analysis: Json | null
          ai_fraud_reasons: string[] | null
          ai_fraud_score: number | null
          ai_recommendations: string[] | null
          amount: number
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bank_account: string | null
          category: string
          created_at: string
          created_by: string
          description: string
          document_number: string | null
          due_date: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          status: string
          supplier_document: string | null
          supplier_name: string
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_fraud_reasons?: string[] | null
          ai_fraud_score?: number | null
          ai_recommendations?: string[] | null
          amount: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          category: string
          created_at?: string
          created_by: string
          description: string
          document_number?: string | null
          due_date: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          supplier_document?: string | null
          supplier_name: string
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_fraud_reasons?: string[] | null
          ai_fraud_score?: number | null
          ai_recommendations?: string[] | null
          amount?: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          document_number?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          supplier_document?: string | null
          supplier_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          audit_type: string
          created_at: string
          created_by: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          resolution_notes: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
        }
        Insert: {
          audit_type: string
          created_at?: string
          created_by: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
        }
        Update: {
          audit_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          created_at: string
          details: Json | null
          execution_date: string
          id: string
          tasks_executed: number | null
          tasks_failed: number | null
          tasks_succeeded: number | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          execution_date?: string
          id?: string
          tasks_executed?: number | null
          tasks_failed?: number | null
          tasks_succeeded?: number | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          execution_date?: string
          id?: string
          tasks_executed?: number | null
          tasks_failed?: number | null
          tasks_succeeded?: number | null
        }
        Relationships: []
      }
      bank_transaction_matches: {
        Row: {
          amount: number
          bank_transaction_id: string
          client_id: string | null
          confidence: number | null
          created_at: string
          created_by: string
          description: string | null
          expense_id: string | null
          id: string
          invoice_id: string | null
        }
        Insert: {
          amount: number
          bank_transaction_id: string
          client_id?: string | null
          confidence?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
        }
        Update: {
          amount?: number
          bank_transaction_id?: string
          client_id?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transaction_matches_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transaction_matches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transaction_matches_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transaction_matches_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          ai_confidence: number | null
          ai_suggestion: string | null
          amount: number
          bank_reference: string | null
          category: string | null
          created_at: string
          created_by: string
          description: string
          has_multiple_matches: boolean
          id: string
          imported_from: string | null
          matched: boolean
          matched_expense_id: string | null
          matched_invoice_id: string | null
          notes: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_suggestion?: string | null
          amount: number
          bank_reference?: string | null
          category?: string | null
          created_at?: string
          created_by: string
          description: string
          has_multiple_matches?: boolean
          id?: string
          imported_from?: string | null
          matched?: boolean
          matched_expense_id?: string | null
          matched_invoice_id?: string | null
          notes?: string | null
          transaction_date: string
          transaction_type: string
        }
        Update: {
          ai_confidence?: number | null
          ai_suggestion?: string | null
          amount?: number
          bank_reference?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string
          has_multiple_matches?: boolean
          id?: string
          imported_from?: string | null
          matched?: boolean
          matched_expense_id?: string | null
          matched_invoice_id?: string | null
          notes?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_matched_expense_id_fkey"
            columns: ["matched_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          code: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          is_synthetic: boolean
          name: string
          parent_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          is_synthetic?: boolean
          name: string
          parent_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          is_synthetic?: boolean
          name?: string
          parent_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_enrichment: {
        Row: {
          atividade_principal: Json | null
          atividades_secundarias: Json | null
          bairro: string | null
          capital_social: number | null
          cep: string | null
          client_id: string
          cnpj: string
          complemento: string | null
          created_at: string
          data_abertura: string | null
          data_source: string
          email: string | null
          id: string
          last_updated: string
          logradouro: string | null
          municipio: string | null
          natureza_juridica: string | null
          nome_fantasia: string | null
          numero: string | null
          porte: string | null
          qsa: Json | null
          razao_social: string | null
          situacao: string | null
          socios: Json | null
          telefone: string | null
          uf: string | null
        }
        Insert: {
          atividade_principal?: Json | null
          atividades_secundarias?: Json | null
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          client_id: string
          cnpj: string
          complemento?: string | null
          created_at?: string
          data_abertura?: string | null
          data_source?: string
          email?: string | null
          id?: string
          last_updated?: string
          logradouro?: string | null
          municipio?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          porte?: string | null
          qsa?: Json | null
          razao_social?: string | null
          situacao?: string | null
          socios?: Json | null
          telefone?: string | null
          uf?: string | null
        }
        Update: {
          atividade_principal?: Json | null
          atividades_secundarias?: Json | null
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          client_id?: string
          cnpj?: string
          complemento?: string | null
          created_at?: string
          data_abertura?: string | null
          data_source?: string
          email?: string | null
          id?: string
          last_updated?: string
          logradouro?: string | null
          municipio?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          porte?: string | null
          qsa?: Json | null
          razao_social?: string | null
          situacao?: string | null
          socios?: Json | null
          telefone?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_enrichment_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_ledger: {
        Row: {
          balance: number
          client_id: string
          created_at: string
          created_by: string
          credit: number | null
          debit: number | null
          description: string
          id: string
          invoice_id: string | null
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
        }
        Insert: {
          balance: number
          client_id: string
          created_at?: string
          created_by: string
          credit?: number | null
          debit?: number | null
          description: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date: string
        }
        Update: {
          balance?: number
          client_id?: string
          created_at?: string
          created_by?: string
          credit?: number | null
          debit?: number | null
          description?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_ledger_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_ledger_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payers: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          notes: string | null
          payer_document: string | null
          payer_name: string
          relationship: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          notes?: string | null
          payer_document?: string | null
          payer_name: string
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          payer_document?: string | null
          payer_name?: string
          relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          atividade_principal: Json | null
          atividades_secundarias: Json | null
          bairro: string | null
          capital_social: number | null
          cep: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          created_by: string
          data_abertura: string | null
          email: string | null
          id: string
          is_pro_bono: boolean
          logradouro: string | null
          monthly_fee: number
          municipio: string | null
          name: string
          natureza_juridica: string | null
          nome_fantasia: string | null
          notes: string | null
          numero: string | null
          payment_day: number | null
          phone: string | null
          porte: string | null
          pro_bono_end_date: string | null
          pro_bono_reason: string | null
          pro_bono_start_date: string | null
          qsa: Json | null
          razao_social: string | null
          situacao_cadastral: string | null
          status: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          atividade_principal?: Json | null
          atividades_secundarias?: Json | null
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          created_by: string
          data_abertura?: string | null
          email?: string | null
          id?: string
          is_pro_bono?: boolean
          logradouro?: string | null
          monthly_fee?: number
          municipio?: string | null
          name: string
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          notes?: string | null
          numero?: string | null
          payment_day?: number | null
          phone?: string | null
          porte?: string | null
          pro_bono_end_date?: string | null
          pro_bono_reason?: string | null
          pro_bono_start_date?: string | null
          qsa?: Json | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          atividade_principal?: Json | null
          atividades_secundarias?: Json | null
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          created_by?: string
          data_abertura?: string | null
          email?: string | null
          id?: string
          is_pro_bono?: boolean
          logradouro?: string | null
          monthly_fee?: number
          municipio?: string | null
          name?: string
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          notes?: string | null
          numero?: string | null
          payment_day?: number | null
          phone?: string | null
          porte?: string | null
          pro_bono_end_date?: string | null
          pro_bono_reason?: string | null
          pro_bono_start_date?: string | null
          qsa?: Json | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      enrichment_logs: {
        Row: {
          client_id: string | null
          client_name: string
          cnpj: string | null
          created_at: string
          created_by: string | null
          data_fetched: Json | null
          error_message: string | null
          error_type: string | null
          execution_time_ms: number | null
          id: string
          socios_count: number | null
          status: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          data_fetched?: Json | null
          error_message?: string | null
          error_type?: string | null
          execution_time_ms?: number | null
          id?: string
          socios_count?: number | null
          status: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          data_fetched?: Json | null
          error_message?: string | null
          error_type?: string | null
          execution_time_ms?: number | null
          id?: string
          socios_count?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          competence: string | null
          cost_center: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string
          id: string
          notes: string | null
          payment_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category: string
          competence?: string | null
          cost_center?: string | null
          created_at?: string
          created_by: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          competence?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_analysis: {
        Row: {
          alerts: Json | null
          analysis_date: string
          created_at: string
          health_score: number | null
          id: string
          insights: Json | null
          metrics: Json | null
          predictions: Json | null
          recommendations: Json | null
          trend: string | null
        }
        Insert: {
          alerts?: Json | null
          analysis_date?: string
          created_at?: string
          health_score?: number | null
          id?: string
          insights?: Json | null
          metrics?: Json | null
          predictions?: Json | null
          recommendations?: Json | null
          trend?: string | null
        }
        Update: {
          alerts?: Json | null
          analysis_date?: string
          created_at?: string
          health_score?: number | null
          id?: string
          insights?: Json | null
          metrics?: Json | null
          predictions?: Json | null
          recommendations?: Json | null
          trend?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          calculated_amount: number | null
          calculation_base: number | null
          client_id: string
          competence: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string
          id: string
          payment_date: string | null
          revenue_type_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          calculated_amount?: number | null
          calculation_base?: number | null
          client_id: string
          competence?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date: string
          id?: string
          payment_date?: string | null
          revenue_type_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          calculated_amount?: number | null
          calculation_base?: number | null
          client_id?: string
          competence?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string
          id?: string
          payment_date?: string | null
          revenue_type_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_revenue_type_id_fkey"
            columns: ["revenue_type_id"]
            isOneToOne: false
            referencedRelation: "revenue_types"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          type: string
          updated_at: string | null
          variables: string[] | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          type: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          type?: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reconciliation_rules: {
        Row: {
          auto_match: boolean
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          pattern: string
          priority: number | null
          rule_name: string
          rule_type: string
          target_account_id: string | null
          target_category: string | null
        }
        Insert: {
          auto_match?: boolean
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          pattern: string
          priority?: number | null
          rule_name: string
          rule_type: string
          target_account_id?: string | null
          target_category?: string | null
        }
        Update: {
          auto_match?: boolean
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          pattern?: string
          priority?: number | null
          rule_name?: string
          rule_type?: string
          target_account_id?: string | null
          target_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_rules_target_account_id_fkey"
            columns: ["target_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_types: {
        Row: {
          calculation_type: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          multiplier: number | null
          name: string
          percentage: number | null
          updated_at: string
          value: number | null
        }
        Insert: {
          calculation_type: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          multiplier?: number | null
          name: string
          percentage?: number | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          calculation_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          multiplier?: number | null
          name?: string
          percentage?: number | null
          updated_at?: string
          value?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
