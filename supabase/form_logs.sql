-- Spustit jednou v Supabase → SQL Editor.
create table if not exists public.form_logs (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  status       text not null check (status in ('success', 'partial', 'failed')),
  email        text,
  ecomail_ok   boolean not null,
  resend_ok    boolean not null,
  supabase_ok  boolean not null,
  meta_ok      boolean not null,
  errors       jsonb
);

create index if not exists form_logs_created_at_idx on public.form_logs (created_at desc);

-- Přístup jen přes service role key (ten RLS obchází); veřejně nic nepovolujeme.
alter table public.form_logs enable row level security;

-- Příklady dotazů:
--   select * from form_logs where status <> 'success' order by created_at desc;
--   select status, count(*) from form_logs where created_at > now() - interval '7 days' group by status;
