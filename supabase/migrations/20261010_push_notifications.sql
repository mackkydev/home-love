-- Browser push endpoints belong to individual users, including members of shared homes.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscription_own_read on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscription_own_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscription_own_update on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscription_own_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- Only the server's secret key can read/write deliveries. Unique keys prevent duplicate pushes.
create table if not exists public.push_deliveries (
  occurrence_key text not null,
  endpoint text not null,
  delivered_at timestamptz not null default now(),
  primary key (occurrence_key, endpoint)
);
create index if not exists push_deliveries_delivered_idx on public.push_deliveries(delivered_at);
alter table public.push_deliveries enable row level security;
