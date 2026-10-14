-- Keep every open household screen in sync when a member changes shared data.
do $$
begin
  alter publication supabase_realtime add table public.entries;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.household_categories;
exception when duplicate_object then null;
end $$;
