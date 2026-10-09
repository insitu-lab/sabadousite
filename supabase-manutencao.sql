-- Execute uma vez no SQL Editor do Supabase.
create table if not exists public.site_settings (
  id smallint primary key check (id = 1),
  maintenance boolean not null default false
);

-- Mantém o prazo já combinado na primeira migração. Não altera prazos salvos.
alter table public.site_settings
  add column if not exists maintenance_until timestamptz
  default '2026-10-10T18:00:00-03:00'::timestamptz;
alter table public.site_settings alter column maintenance_until drop default;

insert into public.site_settings (id, maintenance, maintenance_until)
values (1, false, '2026-10-10T18:00:00-03:00'::timestamptz)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings
  for select to anon, authenticated using (true);

create or replace function public.set_site_maintenance(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'sem permissao';
  end if;

  if p_enabled and exists (
    select 1 from public.site_settings
    where id = 1 and maintenance_until <= now()
  ) then
    raise exception 'Defina uma volta futura ou retire o prazo antes de ativar a manutencao.';
  end if;

  update public.site_settings
  set maintenance = p_enabled
  where id = 1;
end;
$$;

revoke all on function public.set_site_maintenance(boolean) from public, anon;
grant execute on function public.set_site_maintenance(boolean) to authenticated;

create or replace function public.set_site_maintenance_until(p_until timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'sem permissao';
  end if;
  if p_until is not null and (not isfinite(p_until) or p_until <= now()) then
    raise exception 'Escolha uma data de volta no futuro.';
  end if;
  update public.site_settings set maintenance_until = p_until where id = 1;
end;
$$;

revoke all on function public.set_site_maintenance_until(timestamptz) from public, anon;
grant execute on function public.set_site_maintenance_until(timestamptz) to authenticated;
