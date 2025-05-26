pub mod supabase;

pub use supabase::{SupabaseClient, init_db_pool};

// Re-export common database functions
pub use supabase::{
    // Strategy functions
    fetch_strategies,
    fetch_strategy_by_id,
    create_strategy,
    update_strategy,
    delete_strategy,

    // Trade functions
    fetch_trades,
    fetch_trade_by_id,
    create_trade,
    update_trade,
    delete_trade,

    // Budget functions
    fetch_strategy_budget,
    update_strategy_budget,
};
