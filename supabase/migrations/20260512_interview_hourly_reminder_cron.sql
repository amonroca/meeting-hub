-- Migration: 20260512_interview_hourly_reminder_cron.sql
--
-- Configura um job pg_cron que dispara send-scheduled-reminders a cada hora
-- com reminderType="1hour", para enviar lembretes de entrevistas ~1 hora antes.
--
-- O cron diário (20260511_scheduled_reminders_cron.sql) continua responsável
-- pelos lembretes de 4 dias e 1 dia para reuniões e entrevistas.
--
-- Pré-requisitos:
--   1. Extensão pg_cron habilitada:  Dashboard → Database → Extensions → pg_cron
--   2. Extensão pg_net  habilitada:  Dashboard → Database → Extensions → pg_net
--
-- ANTES DE APLICAR: substitua os dois placeholders abaixo pelos valores reais do seu projeto:
--   <PROJECT_REF>       → ID do projeto (ex: abcxyzproject123)
--   <SERVICE_ROLE_KEY>  → Chave service_role (Dashboard → Settings → API)
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Remove job anterior caso exista (idempotência)
do $$ begin if exists (
    select 1
    from cron.job
    where jobname = 'send-interview-hour-reminders'
) then perform cron.unschedule('send-interview-hour-reminders');
end if;
end $$;
-- Agenda o job: toda hora no minuto 0
select cron.schedule(
        'send-interview-hour-reminders',
        '0 * * * *',
        $$
        select net.http_post(
                url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-scheduled-reminders',
                headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>","apikey":"<SERVICE_ROLE_KEY>"}'::jsonb,
                body := '{"reminderType":"1hour"}'::jsonb
            ) $$
    );