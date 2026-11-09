create table public.ai_limits(id boolean primary key default true check(id), daily_requests integer not null check(daily_requests between 0 and 1000));
insert into public.ai_limits values(true,10);
create table public.ai_usage(user_id uuid references auth.users on delete cascade, day date, requests integer not null, last_request timestamptz not null, primary key(user_id,day));
create table public.ai_analyses(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,mode text not null,prompt text not null,response text not null,created_at timestamptz not null default now());
create index ai_history on public.ai_analyses(user_id,created_at desc);
alter table public.ai_limits enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_analyses enable row level security;
revoke all on public.ai_limits,public.ai_usage,public.ai_analyses from public,anon,authenticated;
grant select on public.ai_analyses to authenticated;
create policy read_own_analysis on public.ai_analyses for select to authenticated using(user_id=(select auth.uid()));
create function public.reserve_ai_request(target uuid) returns boolean language plpgsql set search_path='' as $$declare cap integer; begin
select daily_requests into strict cap from public.ai_limits where id;
if cap=0 then return false; end if;
insert into public.ai_usage as u values(target,(now() at time zone 'UTC')::date,1,now())
on conflict(user_id,day) do update set requests=u.requests+1,last_request=now() where u.requests<cap and u.last_request<now()-interval '5 seconds';
return found;end$$;
revoke all on function public.reserve_ai_request(uuid) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid) to service_role;
grant select,insert,update on public.ai_usage to service_role;
grant select on public.ai_limits to service_role;
grant insert on public.ai_analyses to service_role;
