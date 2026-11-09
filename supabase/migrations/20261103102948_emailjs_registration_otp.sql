create table public.registration_codes(id uuid primary key,email text not null,code_hash text not null,ip_hash text not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',tries integer not null default 0,used boolean not null default false,delivered boolean not null default false);
create index registration_email on public.registration_codes(email,created_at);
create index registration_ip on public.registration_codes(ip_hash,created_at);
alter table public.registration_codes enable row level security;
revoke all on public.registration_codes from public,anon,authenticated;
grant all on public.registration_codes to service_role;
create function public.reserve_registration(request_id uuid,target_email text,hashed_code text,hashed_ip text) returns boolean language plpgsql set search_path='' as $$begin
perform pg_advisory_xact_lock(hashtextextended('registration-global',0));
delete from public.registration_codes where created_at<now()-interval '1 day';
if exists(select 1 from public.registration_codes where email=target_email and created_at>now()-interval '60 seconds') or (select count(*) from public.registration_codes where email=target_email and created_at>now()-interval '1 hour')>=5 or (select count(*) from public.registration_codes where ip_hash=hashed_ip and created_at>now()-interval '1 hour')>=10 then return false;end if;
insert into public.registration_codes(id,email,code_hash,ip_hash) values(request_id,target_email,hashed_code,hashed_ip);return true;end$$;
create function public.consume_registration(request_id uuid,target_email text,hashed_code text) returns boolean language plpgsql set search_path='' as $$declare r public.registration_codes;begin
select * into r from public.registration_codes where id=request_id for update;
if not found or r.email<>target_email or r.used or not r.delivered or r.expires_at<=now() or r.tries>=5 then return false;end if;
update public.registration_codes set tries=tries+1 where id=request_id;
if r.code_hash<>hashed_code then return false;end if;
update public.registration_codes set used=true where id=request_id;return true;end$$;
create function public.registration_account(target_email text) returns table(id uuid,confirmed boolean) language sql security definer set search_path='' as $$select id,email_confirmed_at is not null from auth.users where email=target_email limit 1$$;
revoke all on function public.reserve_registration(uuid,text,text,text),public.consume_registration(uuid,text,text),public.registration_account(text) from public,anon,authenticated;
grant execute on function public.reserve_registration(uuid,text,text,text),public.consume_registration(uuid,text,text),public.registration_account(text) to service_role;
