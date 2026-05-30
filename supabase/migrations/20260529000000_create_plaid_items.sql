create table if not exists plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  access_token text not null,
  item_id text not null,
  institution_name text not null default 'Unknown Bank',
  cursor text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint plaid_items_user_id_item_id_key unique (user_id, item_id)
);
