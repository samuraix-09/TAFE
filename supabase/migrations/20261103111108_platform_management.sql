alter table public.profiles
 add column phone text,
 add column avatar_path text,
 add column status text not null default 'active' check(status in ('active','suspended','deleted')),
 add column notifications jsonb not null default '{"learning":true,"tests":true,"subscriptions":true,"updates":true}',
 add column privacy jsonb not null default '{"ai_context":false}',
 add column deletion_requested_at timestamptz;
grant update(phone,avatar_path,notifications,privacy,deletion_requested_at) on public.profiles to authenticated;

create function public.account_active(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=target and status='active')
$$;
revoke all on function public.account_active(uuid) from public,anon;
grant execute on function public.account_active(uuid) to authenticated,service_role;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.user_id=auth.uid() and r.role='admin' and p.status='active')
$$;

alter table public.plans
 add column description text not null default '',
 add column annual_price numeric(12,2) check(annual_price>=0),
 add column is_default boolean not null default false,
 add column ai_daily integer not null default 0 check(ai_daily>=0),
 add column ai_monthly integer not null default 0 check(ai_monthly>=0),
 add column tests_daily integer not null default 0 check(tests_daily>=0),
 add column tests_monthly integer not null default 0 check(tests_monthly>=0),
 add column library_rank integer not null default 0 check(library_rank between 0 and 100),
 add column permissions jsonb not null default '{"ask":true,"explain":true,"practice":true,"plan":true,"analysis":true}';
create unique index one_default_plan on public.plans(is_default) where is_default;
update public.plans set is_default=true,ai_daily=10,ai_monthly=100,tests_daily=5,tests_monthly=30 where name='TAFE Starter';
update public.plans set ai_daily=50,ai_monthly=1000,tests_daily=30,tests_monthly=300,library_rank=1 where name='TAFE Focus';
update public.plans set ai_daily=150,ai_monthly=3000,tests_daily=100,tests_monthly=1000,library_rank=2 where name='TAFE Mastery';

create table public.subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 plan_id uuid not null references public.plans, starts_at timestamptz not null default now(),
 expires_at timestamptz not null, status text not null default 'active' check(status in ('active','cancelled')),
 granted_by uuid references auth.users on delete set null,created_at timestamptz not null default now(),
 check(expires_at>starts_at)
);
create index subscriptions_owner on public.subscriptions(user_id,expires_at);
create table public.payments(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 amount numeric(12,2) not null check(amount>=0),currency text not null default 'UZS',
 status text not null check(status in ('pending','confirmed','failed','refunded')),
 provider text not null,provider_reference text unique,created_at timestamptz not null default now()
);
create index payments_owner on public.payments(user_id,created_at);
create table public.usage_events(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 feature text not null check(feature in ('ai','test')),mode text, tokens integer not null default 0 check(tokens>=0),
 error text,created_at timestamptz not null default now()
);
create index usage_owner on public.usage_events(user_id,feature,created_at);
create table public.audit_logs(
 id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users on delete set null,
 action text not null,entity text not null,entity_id text,details jsonb not null default '{}',created_at timestamptz not null default now()
);
create index audit_date on public.audit_logs(created_at desc);
create table public.platform_settings(
 id boolean primary key default true check(id), platform_name text not null default 'TAFE',
 contact_email text,ai_model text not null default 'gemini-2.5-flash',ai_enabled boolean not null default true,
 ai_prompt text not null default 'You are TAFE AI, an educational tutor. Use supplied evidence, explain uncertainty, and never assign official test scores.'
);
insert into public.platform_settings(id) values(true);
create function public.entitlement(target uuid) returns public.plans language sql stable security definer set search_path='' as $$
 select p from public.plans p where p.active and (
 p.id=(select s.plan_id from public.subscriptions s where s.user_id=target and s.status='active' and s.starts_at<=now() and s.expires_at>now() order by s.created_at desc limit 1)
 or p.is_default) order by p.is_default asc limit 1
$$;
revoke all on function public.entitlement(uuid) from public,anon,authenticated;
grant execute on function public.entitlement(uuid) to service_role;
create function public.my_entitlements() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.plans;daily_ai integer;monthly_ai integer;daily_test integer;monthly_test integer;begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 p:=public.entitlement(auth.uid());
 select count(*) filter(where feature='ai' and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
 count(*) filter(where feature='ai'),count(*) filter(where feature='test' and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
 count(*) filter(where feature='test') into daily_ai,monthly_ai,daily_test,monthly_test
 from public.usage_events where user_id=auth.uid() and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 return jsonb_build_object('plan',to_jsonb(p),'daily_ai',daily_ai,'monthly_ai',monthly_ai,'daily_test',daily_test,'monthly_test',monthly_test,
 'subscription',(select to_jsonb(s) from public.subscriptions s where user_id=auth.uid() and status='active' and starts_at<=now() and expires_at>now() order by created_at desc limit 1));
end$$;
create function public.consume_quota(target uuid,feature_name text,feature_mode text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.plans;daily_cap integer;monthly_cap integer;d integer;m integer;result uuid;begin
 if not public.account_active(target) then raise exception 'Account unavailable';end if;
 if feature_name not in ('ai','test') then raise exception 'Invalid feature';end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text||feature_name,0));
 p:=public.entitlement(target);
 if p.id is null then raise exception 'No active plan configured';end if;
 if feature_name='ai' and not coalesce((p.permissions->>feature_mode)::boolean,false) then raise exception 'Current plan does not include this AI feature';end if;
 daily_cap:=case when feature_name='ai' then p.ai_daily else p.tests_daily end;
 monthly_cap:=case when feature_name='ai' then p.ai_monthly else p.tests_monthly end;
 select count(*) filter(where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),count(*) into d,m from public.usage_events
 where user_id=target and feature=feature_name and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 if d>=daily_cap or m>=monthly_cap then raise exception 'Plan usage limit reached. Check Profile / Subscription.';end if;
 if feature_name='ai' and exists(select 1 from public.usage_events where user_id=target and feature='ai' and created_at>now()-interval '5 seconds') then raise exception 'Please wait before sending another message';end if;
 insert into public.usage_events(user_id,feature,mode) values(target,feature_name,feature_mode) returning id into result;return result;
end$$;
revoke all on function public.consume_quota(uuid,text,text) from public,anon,authenticated;
grant execute on function public.consume_quota(uuid,text,text) to service_role;
revoke all on function public.my_entitlements() from public,anon;
grant execute on function public.my_entitlements() to authenticated;

alter table public.library_resources alter column url drop not null;
alter table public.library_resources
 add column author text not null default '',add column subject text not null default '',
 add column category_id uuid references public.exam_categories,add column language text not null default 'uz',
 add column difficulty text not null default 'intermediate',
 add column publication text not null default '',add column file_path text,add column cover_path text,
 add column published boolean not null default true,add column access_rank integer not null default 0 check(access_rank between 0 and 100);
create function public.can_read_resource(target uuid,resource uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_active(target) and exists(select 1 from public.library_resources r where r.id=resource and r.published and r.access_rank<=coalesce((public.entitlement(target)).library_rank,-1))
$$;
revoke all on function public.can_read_resource(uuid,uuid) from public,anon;
grant execute on function public.can_read_resource(uuid,uuid) to authenticated,service_role;
drop policy resources_read on public.library_resources;
create policy resources_access on public.library_resources for select to authenticated using(public.can_read_resource(auth.uid(),id) or public.is_admin());
create function public.record_admin_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(actor_id,action,entity,entity_id,details) values(auth.uid(),TG_OP,TG_TABLE_NAME,
 coalesce(to_jsonb(NEW)->>'id',to_jsonb(OLD)->>'id'),jsonb_build_object('before',case when TG_OP='INSERT' then null else to_jsonb(OLD) end,'after',case when TG_OP='DELETE' then null else to_jsonb(NEW) end));
 if TG_OP='DELETE' then return OLD;end if;return NEW;
end$$;
revoke all on function public.record_admin_change() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['plans','subscriptions','library_resources','tests','exam_categories','platform_settings'] loop
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function public.record_admin_change()',t);
 end loop;
end$$;
do $$declare t text;begin
 foreach t in array array['subscriptions','payments','usage_events','audit_logs','platform_settings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy admin_read on public.%I for select to authenticated using(public.is_admin())',t);
 end loop;
end$$;
create policy own_subscriptions on public.subscriptions for select to authenticated using(user_id=auth.uid() and public.account_active(auth.uid()));
create policy own_payments on public.payments for select to authenticated using(user_id=auth.uid() and public.account_active(auth.uid()));
create policy own_usage on public.usage_events for select to authenticated using(user_id=auth.uid() and public.account_active(auth.uid()));
grant insert,update on public.subscriptions to authenticated;
create policy admin_subscriptions on public.subscriptions for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant update(platform_name,contact_email,ai_model,ai_enabled,ai_prompt) on public.platform_settings to authenticated;
create policy admin_settings on public.platform_settings for update to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update on public.usage_events to service_role;
grant select on public.platform_settings to service_role;

create function public.admin_users(search_text text default '',page_number integer default 0,page_size integer default 20,status_filter text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not public.is_admin() then raise exception 'Admin authorization required';end if;
 if page_number<0 or page_size<1 or page_size>100 or length(search_text)>120 then raise exception 'Invalid pagination';end if;
 select jsonb_build_object('total',count(*),'users',(select coalesce(jsonb_agg(z),'[]') from (
 select p.id,p.display_name,u.email,p.status,p.created_at,u.email_confirmed_at,u.last_sign_in_at,p.phone,p.deletion_requested_at,
 (public.entitlement(p.id)).name as plan,
 (select max(expires_at) from public.subscriptions where user_id=p.id and status='active') as expires_at,
 (select count(*) from public.test_attempts where user_id=p.id) as attempts
 from public.profiles p join auth.users u on u.id=p.id
 where (search_text='' or p.display_name ilike '%'||search_text||'%' or u.email ilike '%'||search_text||'%') and (status_filter='' or p.status=status_filter)
 order by p.created_at desc limit page_size offset page_number*page_size) z)) into result
 from public.profiles p join auth.users u on u.id=p.id where (search_text='' or p.display_name ilike '%'||search_text||'%' or u.email ilike '%'||search_text||'%') and (status_filter='' or p.status=status_filter);
 return result;
end$$;
create function public.admin_user_detail(target uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if not public.is_admin() then raise exception 'Admin authorization required';end if;
 return jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where id=target),
 'subscriptions',(select coalesce(jsonb_agg(s order by s.created_at desc),'[]') from public.subscriptions s where user_id=target),
 'payments',(select coalesce(jsonb_agg(p order by p.created_at desc),'[]') from public.payments p where user_id=target),
 'attempts',(select coalesce(jsonb_agg(z),'[]') from(select id,test_id,score,total,submitted_at,started_at from public.test_attempts where user_id=target order by started_at desc limit 100) z),
 'usage',(select coalesce(jsonb_agg(z),'[]') from(select feature,count(*) as requests,sum(tokens) as tokens from public.usage_events where user_id=target and created_at>=date_trunc('month',now()) group by feature) z));
end$$;
create function public.admin_account_action(target uuid,operation text,new_name text default null) returns void language plpgsql security definer set search_path='' as $$
declare oldstatus text;begin
 if not public.is_admin() then raise exception 'Admin authorization required';end if;
 if operation not in ('suspend','reactivate','delete','rename') then raise exception 'Invalid action';end if;
 if target=auth.uid() and operation in ('suspend','delete') then raise exception 'Cannot disable your own administrator account';end if;
 select status into oldstatus from public.profiles where id=target for update;if not found then raise exception 'User not found';end if;
 if operation='rename' then
 if new_name is null or length(trim(new_name)) not between 1 and 120 then raise exception 'Invalid name';end if;
 update public.profiles set display_name=trim(new_name) where id=target;
 else
 update public.profiles set status=case operation when 'suspend' then 'suspended' when 'delete' then 'deleted' else 'active' end where id=target;
 end if;
 insert into public.audit_logs(actor_id,action,entity,entity_id,details) values(auth.uid(),operation,'profiles',target::text,jsonb_build_object('previous_status',oldstatus,'name',new_name));
end$$;
create function public.admin_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if not public.is_admin() then raise exception 'Admin authorization required';end if;
 return jsonb_build_object('users',(select count(*) from public.profiles),'tests',(select count(*) from public.tests where published),
 'attempts',(select count(*) from public.test_attempts),'ai',(select count(*) from public.usage_events where feature='ai'),
 'subscribers',(select count(distinct user_id) from public.subscriptions where status='active' and expires_at>now() and starts_at<=now()),
 'revenue',(select coalesce(sum(amount),0) from public.payments where status='confirmed' and currency='UZS'),
 'ai_errors',(select count(*) from public.usage_events where error is not null));
end$$;
revoke all on function public.admin_users(text,integer,integer,text),public.admin_user_detail(uuid),public.admin_account_action(uuid,text,text),public.admin_overview() from public,anon;
grant execute on function public.admin_users(text,integer,integer,text),public.admin_user_detail(uuid),public.admin_account_action(uuid,text,text),public.admin_overview() to authenticated;
alter table public.tests add column description text not null default '',add column section text not null default '',
 add column difficulty text not null default 'intermediate',add column instructions text not null default '',
 add column passage_title text not null default '',add column passage_text text not null default '',
 add column passage_image text,add column access_rank integer not null default 0 check(access_rank between 0 and 100),
 add column kind text not null default 'practice' check(kind in ('practice','mock')),
 add column version integer not null default 1;
alter table public.questions add column type text not null default 'multiple_choice',
 add column config jsonb not null default '{}',add column points integer not null default 1 check(points between 1 and 100),
 add column required boolean not null default true,add column group_name text not null default '';
alter table public.answer_keys add column accepted jsonb,add column explanation text not null default '',add column evidence text not null default '';
create function public.admin_save_test(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare tid uuid;q jsonb;idx integer:=0;expected integer;publish_flag boolean;accepted jsonb;begin
 if not public.is_admin() then raise exception 'Admin authorization required';end if;
 if octet_length(payload::text)>1000000 then raise exception 'Test is too large';end if;
 if length(trim(payload->>'title')) not between 1 and 200 or (payload->>'duration')::int not between 1 and 240 or jsonb_typeof(payload->'questions')<>'array' then raise exception 'Invalid test information';end if;
 expected:=jsonb_array_length(payload->'questions');publish_flag:=coalesce((payload->>'published')::boolean,false);
 if expected>300 or (publish_flag and expected=0) then raise exception 'Add at least one question; maximum 300';end if;
 tid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 if exists(select 1 from public.tests where id=tid) then
 perform 1 from public.tests where id=tid and version=(payload->>'version')::int for update;
 if not found then raise exception 'Another administrator changed this test. Reload it.';end if;
 update public.tests set title=trim(payload->>'title'),category_id=(payload->>'category_id')::uuid,duration=(payload->>'duration')::int,published=publish_flag,
 description=coalesce(payload->>'description',''),section=coalesce(payload->>'section',''),difficulty=coalesce(payload->>'difficulty','intermediate'),
 instructions=coalesce(payload->>'instructions',''),passage_title=coalesce(payload->>'passage_title',''),passage_text=coalesce(payload->>'passage_text',''),
 access_rank=coalesce((payload->>'access_rank')::int,0),kind=coalesce(payload->>'kind','practice'),version=version+1 where id=tid;
 delete from public.questions where test_id=tid;
 else
 insert into public.tests(id,title,category_id,duration,published,description,section,difficulty,instructions,passage_title,passage_text,access_rank,kind)
 values(tid,trim(payload->>'title'),(payload->>'category_id')::uuid,(payload->>'duration')::int,publish_flag,coalesce(payload->>'description',''),coalesce(payload->>'section',''),coalesce(payload->>'difficulty','intermediate'),
 coalesce(payload->>'instructions',''),coalesce(payload->>'passage_title',''),coalesce(payload->>'passage_text',''),coalesce((payload->>'access_rank')::int,0),coalesce(payload->>'kind','practice'));
 end if;
 for q in select * from jsonb_array_elements(payload->'questions') loop
 if length(trim(q->>'prompt')) not between 1 and 10000 or q->>'type' not in ('multiple_choice','multiple_select','true_false_not_given','yes_no_not_given','matching_headings','matching_information','matching_features','matching_sentence_endings','sentence_completion','summary_completion','table_completion','short_answer','written_answer','numeric_answer','fill_blanks') or jsonb_typeof(q->'options')<>'array' then raise exception 'Invalid question configuration';end if;
 accepted:=q->'accepted';
 if publish_flag then
 if accepted is null or accepted = any(array['null','[]','{}','""']::jsonb[]) then raise exception 'Every published question needs an answer';end if;
 if q->>'type' in ('multiple_choice','multiple_select','true_false_not_given','yes_no_not_given') and jsonb_array_length(q->'options')<2 then raise exception 'Add answer options';end if;
 if q->>'type'='multiple_select' and jsonb_typeof(accepted)<>'array' then raise exception 'Select correct answers';end if;
 end if;
 insert into public.questions(id,test_id,prompt,options,position,type,config,points,required,group_name)
 values((q->>'id')::uuid,tid,trim(q->>'prompt'),q->'options',idx,q->>'type',coalesce(q->'config','{}'),coalesce((q->>'points')::int,1),coalesce((q->>'required')::boolean,true),coalesce(q->>'group_name',''));
 insert into public.answer_keys(question_id,answer,accepted,explanation,evidence)
 values((q->>'id')::uuid,coalesce(q->>'answer',''),accepted,coalesce(q->>'explanation',''),coalesce(q->>'evidence',''));
 idx:=idx+1;
 end loop;
 return tid;
end$$;
revoke all on function public.admin_save_test(jsonb) from public,anon;
grant execute on function public.admin_save_test(jsonb) to authenticated;

create function public.normalize_answer(value text) returns text language sql immutable set search_path='' as $$
 select lower(regexp_replace(trim(value),'\s+',' ','g'))
$$;
revoke all on function public.normalize_answer(text) from public,anon,authenticated;
create function public.answer_matches(kind text,response jsonb,accepted jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;v jsonb;begin
 if response is null or response='null' then return false;end if;
 if kind='multiple_select' then
 if jsonb_typeof(response)<>'array' or jsonb_typeof(accepted)<>'array' then return false;end if;
 return response @> accepted and accepted @> response;
 elsif kind like 'matching_%' or kind in ('summary_completion','table_completion','fill_blanks') then
 if jsonb_typeof(response)<>'object' or jsonb_typeof(accepted)<>'object' then return false;end if;
 for k,v in select * from jsonb_each(accepted) loop
 if not public.answer_matches('short_answer',response->k,case when jsonb_typeof(v)='array' then v else jsonb_build_array(v) end) then return false;end if;
 end loop;return accepted<>'{}'::jsonb;
 elsif kind='numeric_answer' then
 if jsonb_typeof(accepted)<>'array' then return false;end if;
 for v in select * from jsonb_array_elements(accepted) loop
 begin if (response#>>'{}')::numeric=(v#>>'{}')::numeric then return true;end if;exception when invalid_text_representation or numeric_value_out_of_range then null;end;
 end loop;return false;
 else
 if jsonb_typeof(accepted)='array' then
 return exists(select 1 from jsonb_array_elements_text(accepted) a where public.normalize_answer(response#>>'{}')=public.normalize_answer(a));
 end if;
 return public.normalize_answer(response#>>'{}')=public.normalize_answer(accepted#>>'{}');
 end if;
end$$;
revoke all on function public.answer_matches(text,jsonb,jsonb) from public,anon,authenticated;

create or replace function public.start_test(t uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts;exam public.tests;snap jsonb;p public.plans;begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||t::text,0));
 select * into exam from public.tests where id=t and published;
 if not found then raise exception 'Test unavailable';end if;
 select * into a from public.test_attempts where user_id=auth.uid() and test_id=t and submitted_at is null;
 if not found then
 p:=public.entitlement(auth.uid());
 if exam.access_rank>p.library_rank or (exam.kind='mock' and not coalesce((p.permissions->>'full_mock')::boolean,false)) then raise exception 'Your plan does not include this test';end if;
 select jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'options',q.options,'type',q.type,'config',q.config,'points',q.points,'group_name',q.group_name,
 'answer',k.answer,'accepted',coalesce(k.accepted,to_jsonb(k.answer)),'explanation',k.explanation,'evidence',k.evidence) order by q.position) into snap from public.questions q join public.answer_keys k on k.question_id=q.id where q.test_id=t;
 if snap is null then raise exception 'Test has no graded questions';end if;
 perform public.consume_quota(auth.uid(),'test',exam.kind);
 insert into public.test_attempts(user_id,test_id,expires_at,total,snapshot) values(auth.uid(),t,now()+make_interval(mins=>exam.duration),
 (select sum(coalesce((x->>'points')::int,1)) from jsonb_array_elements(snap) x),snap) returning * into a;
 end if;
 return jsonb_build_object('id',a.id,'expires_at',a.expires_at,'answers',a.answers,'title',exam.title,'instructions',exam.instructions,'passage_title',exam.passage_title,'passage_text',exam.passage_text,
 'questions',(select jsonb_agg(x-array['answer','accepted','explanation','evidence']) from jsonb_array_elements(a.snapshot) x));
end$$;
create or replace function public.save_attempt(attempt uuid,response jsonb,finish boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts;n integer;begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 select * into a from public.test_attempts where id=attempt and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt unavailable';end if;
 if a.submitted_at is not null then return jsonb_build_object('score',a.score,'total',a.total,'submitted',true);end if;
 if jsonb_typeof(response)<>'object' or octet_length(response::text)>100000 then raise exception 'Invalid answers';end if;
 if now()<a.expires_at then a.answers=response;end if;
 if finish or now()>=a.expires_at then
 select coalesce(sum(coalesce((x->>'points')::int,1)) filter(where public.answer_matches(coalesce(x->>'type','multiple_choice'),a.answers->(x->>'id'),coalesce(x->'accepted',to_jsonb(x->>'answer')))),0)
 into n from jsonb_array_elements(a.snapshot) x;
 update public.test_attempts set answers=a.answers,submitted_at=now(),score=n where id=a.id;
 return jsonb_build_object('score',n,'total',a.total,'submitted',true);
 end if;
 update public.test_attempts set answers=a.answers where id=a.id;return jsonb_build_object('submitted',false);
end$$;
create function public.attempt_review(attempt uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.test_attempts;begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 select * into a from public.test_attempts where id=attempt and user_id=auth.uid() and submitted_at is not null;
 if not found then raise exception 'Completed attempt required';end if;
 return jsonb_build_object('questions',a.snapshot,'answers',a.answers,'score',a.score,'total',a.total);
end$$;
revoke all on function public.attempt_review(uuid) from public,anon;
grant execute on function public.attempt_review(uuid) to authenticated;

create table public.ai_conversations(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,title text not null default 'Yangi suhbat' check(length(title) between 1 and 160),created_at timestamptz not null default now());
create index conversations_owner on public.ai_conversations(user_id,created_at desc);
create table public.ai_messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.ai_conversations on delete cascade,role text not null check(role in ('user','assistant')),content text not null,created_at timestamptz not null default now());
create index messages_conversation on public.ai_messages(conversation_id,created_at);
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
revoke all on public.ai_conversations,public.ai_messages from anon,authenticated;
grant select,insert,update,delete on public.ai_conversations to authenticated;
grant select on public.ai_messages to authenticated;
grant all on public.ai_conversations,public.ai_messages to service_role;
create policy own_conversations on public.ai_conversations for all to authenticated using(user_id=auth.uid() and public.account_active(auth.uid())) with check(user_id=auth.uid() and public.account_active(auth.uid()));
create policy own_messages on public.ai_messages for select to authenticated using(public.account_active(auth.uid()) and exists(select 1 from public.ai_conversations c where c.id=conversation_id and c.user_id=auth.uid()));
insert into public.ai_conversations(id,user_id,title,created_at) select id,user_id,left(prompt,120),created_at from public.ai_analyses;
insert into public.ai_messages(conversation_id,role,content,created_at) select id,'user',prompt,created_at from public.ai_analyses;
insert into public.ai_messages(conversation_id,role,content,created_at) select id,'assistant',response,created_at+interval '1 millisecond' from public.ai_analyses;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('tafe-documents','tafe-documents',false,26214400,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
 ('tafe-covers','tafe-covers',false,3145728,array['image/jpeg','image/png','image/webp']),
 ('tafe-avatars','tafe-avatars',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy admin_library_files on storage.objects for all to authenticated using(bucket_id in ('tafe-documents','tafe-covers') and public.is_admin()) with check(bucket_id in ('tafe-documents','tafe-covers') and public.is_admin());
create policy read_library_files on storage.objects for select to authenticated using(
 (bucket_id='tafe-documents' and exists(select 1 from public.library_resources r where r.file_path=name and public.can_read_resource(auth.uid(),r.id)))
 or (bucket_id='tafe-covers' and exists(select 1 from public.library_resources r where r.cover_path=name and public.can_read_resource(auth.uid(),r.id))));
create policy own_avatar on storage.objects for all to authenticated using(bucket_id='tafe-avatars' and (storage.foldername(name))[1]=auth.uid()::text and public.account_active(auth.uid())) with check(bucket_id='tafe-avatars' and (storage.foldername(name))[1]=auth.uid()::text and public.account_active(auth.uid()));

drop policy visible_categories on public.exam_categories;
create policy visible_categories on public.exam_categories for select to authenticated using(active and public.account_active(auth.uid()));
drop policy tests_read on public.tests;
create policy tests_read on public.tests for select to authenticated using((published and public.account_active(auth.uid())) or public.is_admin());
drop policy attempts_read on public.test_attempts;
create policy attempts_read on public.test_attempts for select to authenticated using(user_id=auth.uid() and public.account_active(auth.uid()));
drop policy read_own_analysis on public.ai_analyses;
create policy read_own_analysis on public.ai_analyses for select to authenticated using(user_id=auth.uid() and public.account_active(auth.uid()));

