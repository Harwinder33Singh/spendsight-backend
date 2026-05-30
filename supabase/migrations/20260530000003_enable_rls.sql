-- Enable Row Level Security on all user-data tables.
-- auth.uid() is the verified user ID extracted from the JWT — clients cannot spoof it.

-- ── profiles ─────────────────────────────────────────────────────────────────

alter table profiles enable row level security;

create policy "users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── plaid_items ───────────────────────────────────────────────────────────────

alter table plaid_items enable row level security;

create policy "users can read own plaid items"
  on plaid_items for select
  using (auth.uid()::text = user_id);

create policy "users can insert own plaid items"
  on plaid_items for insert
  with check (auth.uid()::text = user_id);

create policy "users can update own plaid items"
  on plaid_items for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create policy "users can delete own plaid items"
  on plaid_items for delete
  using (auth.uid()::text = user_id);

-- ── transactions ──────────────────────────────────────────────────────────────

alter table transactions enable row level security;

create policy "users can read own transactions"
  on transactions for select
  using (auth.uid()::text = user_id);

create policy "users can insert own transactions"
  on transactions for insert
  with check (auth.uid()::text = user_id);

create policy "users can update own transactions"
  on transactions for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create policy "users can delete own transactions"
  on transactions for delete
  using (auth.uid()::text = user_id);
