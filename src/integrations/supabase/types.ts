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
      clients: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          monthly_fee: number
          name: string
          notes: string | null
          payment_day: number | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          monthly_fee?: number
          name: string
          notes?: string | null
          payment_day?: number | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          monthly_fee?: number
          name?: string
          notes?: string | null
          payment_day?: number | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          competence: string | null
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
