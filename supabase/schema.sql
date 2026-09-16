-- =====================================================================
-- Tentaklik Website PM — skema database Supabase
-- Jalankan sekali di Supabase: SQL Editor > New query > tempel > Run
-- =====================================================================

-- 1) Tabel tugas (kolom mengikuti file Excel "Rombak Total Website Utama Tentaklik")
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  status       text not null default 'todo' check (status in ('todo', 'progress', 'done')),
  halaman      text not null default '',
  pekerjaan    text not null check (length(trim(pekerjaan)) > 0),
  arahan       text not null default '',
  screenshot   text not null default '',
  copywriting  text not null default '',
  referensi    text not null default '',
  pic          text not null default '',
  deadline     date,
  catatan      text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   text
);

create index if not exists tasks_created_at_idx on public.tasks (created_at);

-- updated_at otomatis setiap baris berubah
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- 2) Daftar email anggota tim yang boleh membuka board
create table if not exists public.team_members (
  email      text primary key,
  added_at   timestamptz not null default now()
);

create or replace function public.is_team_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 3) Row Level Security: hanya anggota tim yang login bisa baca & tulis
alter table public.tasks enable row level security;
alter table public.team_members enable row level security;

drop policy if exists "tim bisa membaca tugas" on public.tasks;
create policy "tim bisa membaca tugas" on public.tasks
  for select to authenticated using (public.is_team_member());

drop policy if exists "tim bisa menambah tugas" on public.tasks;
create policy "tim bisa menambah tugas" on public.tasks
  for insert to authenticated with check (public.is_team_member());

drop policy if exists "tim bisa mengubah tugas" on public.tasks;
create policy "tim bisa mengubah tugas" on public.tasks
  for update to authenticated using (public.is_team_member()) with check (public.is_team_member());

drop policy if exists "tim bisa menghapus tugas" on public.tasks;
create policy "tim bisa menghapus tugas" on public.tasks
  for delete to authenticated using (public.is_team_member());

-- Setiap user hanya bisa mengecek keanggotaan dirinya sendiri
drop policy if exists "cek keanggotaan sendiri" on public.team_members;
create policy "cek keanggotaan sendiri" on public.team_members
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 4) Realtime: perubahan tugas langsung terkirim ke semua browser tim
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

-- 5) Tambahkan email tim (ganti dengan email asli, satu baris per orang)
-- insert into public.team_members (email) values
--   ('ghani@tentaklik.com'),
--   ('webdev@tentaklik.com');
