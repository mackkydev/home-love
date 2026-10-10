-- Run once after creating a Vault secret named push_cron_secret and setting the
-- same value as NOTIFICATION_CRON_SECRET in Vercel.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'home-love-push-minute') then
    perform cron.unschedule('home-love-push-minute');
  end if;
end $$;

select cron.schedule(
  'home-love-push-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://home-love-pi.vercel.app/api/notifications/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'push_cron_secret' limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
