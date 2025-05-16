mod supabase;

pub use supabase::{SupabaseClient, init_db_pool};

// Re-export common database functions
pub use supabase::{
    fetch_strategies,
    fetch_strategy_by_id,
    create_strategy,
    update_strategy,
    delete_strategy,
    fetch_trades,
    fetch_trade_by_id,
    create_trade,
    update_trade,
    delete_trade,
};
