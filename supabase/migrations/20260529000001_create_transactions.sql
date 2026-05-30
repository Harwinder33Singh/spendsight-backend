create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plaid_transaction_id text not null unique,
  account_id text not null,
  item_id text not null,
  institution_name text not null,
  amount numeric not null,
  date date not null,
  merchant_name text,
  plaid_category text not null default 'Other',
  pending boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_id_idx on transactions(user_id);
create index if not exists transactions_date_idx on transactions(date desc);
