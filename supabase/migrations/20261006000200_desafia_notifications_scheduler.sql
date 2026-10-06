-- Requires existing pg_cron, pg_net and Vault configuration in the shared project.
-- Register only the DesafIA job. No extensions/secrets/global settings are changed.
begin;

select cron.unschedule('desafia-notifications')
where exists (
  select 1 from cron.job where jobname = 'desafia-notifications'
);

select cron.schedule(
  'desafia-notifications',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'project_url'
      ) || '/functions/v1/desafia-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'cron_secret_key'
        )
      ),
      body := '{"action":"process"}'::jsonb
    );
  $cron$
);

commit;
