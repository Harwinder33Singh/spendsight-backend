-- Adds an index on profiles.revenuecat_id so the webhook lookup is fast
-- when RevenueCat sends an app_user_id to update.

create index if not exists profiles_revenuecat_id_idx on profiles(revenuecat_id);
