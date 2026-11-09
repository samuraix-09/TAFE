alter table public.profiles add column target_exam uuid references public.exam_categories(id),add column preparation_level text check(preparation_level in ('beginner','intermediate','advanced')),add column onboarded_at timestamptz;
grant update(target_exam,preparation_level,onboarded_at) on public.profiles to authenticated;
create table public.plans(id uuid primary key default gen_random_uuid(),name text not null unique,monthly_price numeric(12,2) check(monthly_price>=0),currency text not null default 'UZS',features jsonb not null default '[]' check(jsonb_typeof(features)='array'),active boolean not null default false,display_order integer not null default 0);
alter table public.plans enable row level security;
revoke all on public.plans from anon,authenticated;
grant select on public.plans to anon,authenticated;
grant insert,update,delete on public.plans to authenticated;
create policy published_plans on public.plans for select to anon,authenticated using(active or public.is_admin());
create policy admin_plans on public.plans for all to authenticated using(public.is_admin()) with check(public.is_admin());
insert into public.plans(name,monthly_price,active,display_order) values('TAFE Starter',0,true,1),('TAFE Focus',null,true,2),('TAFE Mastery',null,true,3);
grant select on public.exam_categories to anon;
create policy public_exam_catalog on public.exam_categories for select to anon using(active);
alter table public.registration_codes add column flow text not null default 'legacy' check(flow in ('legacy','signup','recovery'));
update public.registration_codes set used=true where flow='legacy';

