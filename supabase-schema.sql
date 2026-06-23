-- 멤버 테이블
create table public.members (
  id uuid primary key default gen_random_uuid(),
  nickname text not null unique,
  created_at timestamptz default now()
);

-- 캐릭터 테이블
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade not null,
  name text not null,
  class text not null,
  role text not null check (role in ('dps', 'support')),
  created_at timestamptz default now()
);

-- 레이드 테이블
create table public.raids (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  size integer not null check (size in (4, 8)),
  day_of_week text check (day_of_week in ('월','화','수','목','금','토','일')),
  time text,
  created_at timestamptz default now()
);

-- 레이드-캐릭터 매핑 테이블
create table public.raid_characters (
  id uuid primary key default gen_random_uuid(),
  raid_id uuid references public.raids(id) on delete cascade not null,
  character_id uuid references public.characters(id) on delete cascade not null,
  unique(raid_id, character_id)
);

-- 주간 스케줄 테이블
create table public.weekly_schedules (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade not null,
  week_start date not null,
  available_days text[] not null default '{}',
  note text,
  updated_at timestamptz default now(),
  unique(member_id, week_start)
);

-- 배너 갤러리 테이블
create table public.banner_gallery (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  created_at timestamptz default now()
);

-- RLS 비활성화 (소규모 그룹용 — 전체 공개)
alter table public.members enable row level security;
alter table public.characters enable row level security;
alter table public.raids enable row level security;
alter table public.raid_characters enable row level security;
alter table public.weekly_schedules enable row level security;

create policy "전체 허용" on public.members for all using (true) with check (true);
create policy "전체 허용" on public.characters for all using (true) with check (true);
create policy "전체 허용" on public.raids for all using (true) with check (true);
create policy "전체 허용" on public.raid_characters for all using (true) with check (true);
create policy "전체 허용" on public.weekly_schedules for all using (true) with check (true);

alter table public.banner_gallery enable row level security;
create policy "전체 허용" on public.banner_gallery for all using (true) with check (true);
