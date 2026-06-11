-- Manual accounts: bank/cash accounts the user creates inside the app (not via Plaid).
-- The id is assigned by the iOS app (Core Data UUID) so on restore we can match records exactly.

create table if not exists manual_accounts (
  id          uuid        primary key,
  user_id     text        not null,
  name        text        not null,
  type        text        not null,   -- "Checking" | "Savings" | "Credit Card" | "Cash" | "Investment" | "Other"
  institution text,
  last4       text,
  created_at  timestamptz not null default now()
);

create index if not exists manual_accounts_user_id_idx on manual_accounts (user_id);

-- ─────────────────────────────────────────────────────────────────────────────

-- Manual transactions: expenses and payments entered by the user (not imported from Plaid).
-- category_name stores the display name so the iOS app can match it to a local Core Data Category on restore.
-- account_id references manual_accounts — nullable because an account may be deleted later.

create table if not exists manual_transactions (
  id              uuid        primary key,
  user_id         text        not null,
  amount          numeric     not null,
  title           text        not null,
  merchant        text        not null default '',
  date            timestamptz not null,
  notes           text,
  payment_method  text        not null default '',
  category_name   text,
  account_id      uuid        references manual_accounts (id) on delete set null,
  is_recurring    boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists manual_transactions_user_id_idx  on manual_transactions (user_id);
create index if not exists manual_transactions_date_idx     on manual_transactions (date desc);

-- ─────────────────────────────────────────────────────────────────────────────

-- Manual income: income records entered by the user.

create table if not exists manual_income (
  id          uuid        primary key,
  user_id     text        not null,
  amount      numeric     not null,
  source      text        not null,
  date        timestamptz not null,
  notes       text,
  account_id  uuid        references manual_accounts (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists manual_income_user_id_idx on manual_income (user_id);
create index if not exists manual_income_date_idx    on manual_income (date desc);

-- ─────────────────────────────────────────────────────────────────────────────

-- Keep updated_at current on manual_transactions (reuses the set_updated_at() function
-- defined in 20260530000002_create_profiles.sql).

create trigger manual_transactions_updated_at
  before update on manual_transactions
  for each row execute function set_updated_at();
