-- Row Level Security for manual data tables.
-- Pattern matches the existing RLS in 20260530000003_enable_rls.sql.
-- auth.uid()::text = user_id ensures each user can only access their own rows.

-- ── manual_accounts ───────────────────────────────────────────────────────────

alter table manual_accounts enable row level security;

create policy "users can read own manual accounts"
  on manual_accounts for select
  using (auth.uid()::text = user_id);

create policy "users can insert own manual accounts"
  on manual_accounts for insert
  with check (auth.uid()::text = user_id);

create policy "users can update own manual accounts"
  on manual_accounts for update
  using  (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create policy "users can delete own manual accounts"
  on manual_accounts for delete
  using (auth.uid()::text = user_id);

-- ── manual_transactions ───────────────────────────────────────────────────────

alter table manual_transactions enable row level security;

create policy "users can read own manual transactions"
  on manual_transactions for select
  using (auth.uid()::text = user_id);

create policy "users can insert own manual transactions"
  on manual_transactions for insert
  with check (auth.uid()::text = user_id);

create policy "users can update own manual transactions"
  on manual_transactions for update
  using  (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create policy "users can delete own manual transactions"
  on manual_transactions for delete
  using (auth.uid()::text = user_id);

-- ── manual_income ─────────────────────────────────────────────────────────────

alter table manual_income enable row level security;

create policy "users can read own manual income"
  on manual_income for select
  using (auth.uid()::text = user_id);

create policy "users can insert own manual income"
  on manual_income for insert
  with check (auth.uid()::text = user_id);

create policy "users can update own manual income"
  on manual_income for update
  using  (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create policy "users can delete own manual income"
  on manual_income for delete
  using (auth.uid()::text = user_id);
