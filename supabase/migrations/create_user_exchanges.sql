-- Create user_exchanges table
create table if not exists public.user_exchanges (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    encrypted_credentials text not null,
    testnet boolean default false,
    use_usdx boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_exchanges enable row level security;

-- Create RLS policies
create policy "Users can view their own exchanges"
    on public.user_exchanges for select
    using (auth.uid() = user_id);

create policy "Users can insert their own exchanges"
    on public.user_exchanges for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own exchanges"
    on public.user_exchanges for update
    using (auth.uid() = user_id);

create policy "Users can delete their own exchanges"
    on public.user_exchanges for delete
    using (auth.uid() = user_id);

-- Create updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger handle_updated_at
    before update on public.user_exchanges
    for each row
    execute procedure public.handle_updated_at();

-- Create indexes
create index idx_user_exchanges_user_id on public.user_exchanges(user_id);