export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface SupabaseError {
  code: string;
  details: string | null;
  hint: string | null;
  message: string;
}

export type Database = {
  public: {
    Tables: {
      strategies: {
        Row: {
          id: string
          title: string
          description: string | null
          type: string
          status: string
          performance: number
          risk_level: string
          user_id: string
          strategy_config: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          type: string
          status?: string
          performance?: number
          risk_level: string
          user_id: string
          strategy_config?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          type?: string
          status?: string
          performance?: number
          risk_level?: string
          user_id?: string
          strategy_config?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      strategy_budgets: {
        Row: {
          id: string
          strategy_id: string
          total: number
          allocated: number
          available: number
          max_position_size: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          strategy_id: string
          total: number
          allocated?: number
          available?: number
          max_position_size: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          strategy_id?: string
          total?: number
          allocated?: number
          available?: number
          max_position_size?: number
          created_at?: string
          updated_at?: string
        }
      }
      budget_history: {
        Row: {
          id: string
          budget_id: string
          total_before: number
          total_after: number
          allocated_before: number
          allocated_after: number
          available_before: number
          available_after: number
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          budget_id: string
          total_before: number
          total_after: number
          allocated_before: number
          allocated_after: number
          available_before: number
          available_after: number
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          budget_id?: string
          total_before?: number
          total_after?: number
          allocated_before?: number
          allocated_after?: number
          available_before?: number
          available_after?: number
          reason?: string | null
          created_at?: string
        }
      }
      strategy_templates: {
        Row: {
          id: string
          title: string
          description: string | null
          risk_level: string
          metrics: Json
          config: Json | null
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          risk_level: string
          metrics?: Json
          config?: Json | null
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          risk_level?: string
          metrics?: Json
          config?: Json | null
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      strategy_trades: {
        Row: {
          id: string
          strategy_id: string
          pair: string
          type: string
          entry_price: number
          current_price: number
          pnl: number
          pnl_percent: number
          status: string
          duration: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          strategy_id: string
          pair: string
          type: string
          entry_price: number
          current_price: number
          pnl?: number
          pnl_percent?: number
          status?: string
          duration?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          strategy_id?: string
          pair?: string
          type?: string
          entry_price?: number
          current_price?: number
          pnl?: number
          pnl_percent?: number
          status?: string
          duration?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Strategy = Database['public']['Tables']['strategies']['Row']
export type StrategyTemplate = Database['public']['Tables']['strategy_templates']['Row']
export type StrategyTrade = Database['public']['Tables']['strategy_trades']['Row']
export type StrategyBudget = Database['public']['Tables']['strategy_budgets']['Row']
export type BudgetHistory = Database['public']['Tables']['budget_history']['Row']