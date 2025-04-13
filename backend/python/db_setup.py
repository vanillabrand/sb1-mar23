import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

def setup_database():
    """Set up the necessary database tables if they don't exist"""
    try:
        # Check if strategy_budgets table exists
        print("Setting up strategy_budgets table...")
        
        # Create the table using SQL
        supabase.rpc('create_strategy_budgets_table', {}).execute()
        print("strategy_budgets table created or already exists")
    except Exception as e:
        print(f"Error creating strategy_budgets table: {str(e)}")
        print("Table may already exist or you may need to create it manually")
    
    print("Database setup complete")

if __name__ == "__main__":
    setup_database()
