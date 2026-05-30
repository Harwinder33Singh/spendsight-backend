-- Creates a public profile for every auth user.
-- Linked 1-to-1 with auth.users via the same UUID.

create table if not exists profiles (
  id                      uuid references auth.users(id) on delete cascade primary key,
  full_name               text,
  email                   text,
  avatar_url              text,
  subscription_tier       text not null default 'free',       -- 'free' | 'pro'
  subscription_status     text not null default 'active',     -- 'active' | 'expired' | 'cancelled'
  subscription_expires_at timestamptz,
  revenuecat_id           text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Auto-create a profile row whenever a new user signs up
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keep updated_at current on every update
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();
