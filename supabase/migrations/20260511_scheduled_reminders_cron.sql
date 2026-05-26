-- Migration: 20260509_scheduled_reminders_cron.sql
--
-- Configura um job pg_cron que dispara a Edge Function send-scheduled-reminders
-- todos os dias às 14h (horário de Brasília = 17h UTC).
--
-- Pré-requisitos:
--   1. Extensão pg_cron habilitada:  Dashboard → Database → Extensions → pg_cron
--   2. Extensão pg_net  habilitada:  Dashboard → Database → Extensions → pg_net
--
-- ANTES DE APLICAR: substitua os dois placeholders abaixo pelos valores reais do seu projeto:
--   <PROJECT_REF>       → ID do projeto (ex: abcxyzproject123)
--   <SERVICE_ROLE_KEY>  → Chave service_role (Dashboard → Settings → API)
-- Garante que as extensões existem
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Remove job anterior caso exista (idempotência)
do $$ begin if exists (
    select 1
    from cron.job
    where jobname = 'send-scheduled-reminders'
) then perform cron.unschedule('send-scheduled-reminders');
end if;
end $$;
-- Agenda o job: todo dia às 17:00 UTC (= 14:00 America/Sao_Paulo)
select cron.schedule(
        'send-scheduled-reminders',
        '0 17 * * *',
        $$
        select net.http_post(
                url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-scheduled-reminders',
                headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>","apikey":"<SERVICE_ROLE_KEY>"}'::jsonb,
                body := '{}'::jsonb
            ) $$
    );