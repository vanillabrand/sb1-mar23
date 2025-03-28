export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      strategies: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          user_id: string;
          name: string;
          description: string;
          config: Json;
          status: 'active' | 'paused' | 'stopped';
          performance_metrics: Json;
        };
        Insert: Omit<Database['public']['Tables']['strategies']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['strategies']['Row']>;
      };
      trades: {
        Row: {
          id: string;
          created_at: string;
          strategy_id: string;
          symbol: string;
          side: 'buy' | 'sell';
          quantity: number;
          price: number;
          status: 'pending' | 'executed' | 'cancelled' | 'failed';
        };
        Insert: Omit<Database['public']['Tables']['trades']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['trades']['Row']>;
      };
      // Add other tables as needed
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type Strategy = Database['public']['Tables']['strategies']['Row'];
export type Trade = Database['public']['Tables']['trades']['Row'];
// Add other types as needed
