-- ============================================================
-- Sabadou — avisos ao vivo + conta de administrador (Supabase)
-- Cole tudo isto em: Supabase > SQL Editor > New query > Run
-- ============================================================

-- 1) Quem é administrador (só quem estiver nesta tabela pode escrever avisos)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
create policy "admin le a si mesmo" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- 2) Avisos
create table if not exists public.avisos (
  id        bigint generated always as identity primary key,
  titulo    text not null check (char_length(titulo) between 1 and 120),
  texto     text not null check (char_length(texto)  between 1 and 2000),
  fixado    boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table public.avisos enable row level security;

-- qualquer pessoa pode LER
create policy "todos leem avisos" on public.avisos
  for select to anon, authenticated using (true);

-- só administrador pode CRIAR, EDITAR e APAGAR
create policy "admin cria aviso" on public.avisos
  for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "admin edita aviso" on public.avisos
  for update to authenticated
  using      (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "admin apaga aviso" on public.avisos
  for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- 3) DEPOIS de criar o seu usuário em Authentication > Users,
--    rode esta linha (troque pelo e-mail que você criou lá):
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'SEU_EMAIL_DE_ADMIN';
