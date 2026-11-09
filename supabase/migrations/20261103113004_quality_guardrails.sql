drop function public.admin_users(text,integer,integer,text);
create function public.admin_users(search_text text default '',page_number integer default 0,page_size integer default 20,status_filter text default '',sort_key text default 'registered_desc') returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 order by
 case when sort_key='name_asc' then lower(p.display_name) end asc,
 case when sort_key='name_desc' then lower(p.display_name) end desc,
 case when sort_key='registered_asc' then p.created_at end asc,
 case when sort_key='activity_desc' then u.last_sign_in_at end desc nulls last,
 p.created_at desc limit page_size offset page_number*page_size) z)) into result
 from public.profiles p join auth.users u on u.id=p.id where (search_text='' or p.display_name ilike '%'||search_text||'%' or u.email ilike '%'||search_text||'%') and (status_filter='' or p.status=status_filter);
 return result;
end$$;

revoke all on function public.admin_users(text,integer,integer,text,text) from public,anon;
grant execute on function public.admin_users(text,integer,integer,text,text) to authenticated;

create function public.bump_test_version() returns trigger language plpgsql set search_path='' as $$
begin if NEW.version=OLD.version then NEW.version:=OLD.version+1;end if;return NEW;end$$;
revoke all on function public.bump_test_version() from public,anon,authenticated;
create trigger bump_version before update on public.tests for each row execute function public.bump_test_version();
create function public.can_access_test(target uuid,test_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select public.account_active(target) and exists(select 1 from public.tests t where t.id=test_id and t.published
and t.access_rank<=coalesce((public.entitlement(target)).library_rank,-1)
and (t.kind='practice' or coalesce(((public.entitlement(target)).permissions->>'full_mock')::boolean,false)))
$$;
revoke all on function public.can_access_test(uuid,uuid) from public,anon;
grant execute on function public.can_access_test(uuid,uuid) to authenticated,service_role;
drop policy tests_read on public.tests;
create policy tests_read on public.tests for select to authenticated using(public.can_access_test(auth.uid(),id) or public.is_admin());
create or replace function public.can_read_test_image(image_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tests t where t.passage_image=image_path and public.can_access_test(auth.uid(),t.id))
$$;
create function public.public_contact() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('platform_name',platform_name,'contact_email',contact_email) from public.platform_settings where id
$$;
revoke all on function public.public_contact() from public;
grant execute on function public.public_contact() to anon,authenticated;
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
 select jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'options',q.options,'type',q.type,'config',q.config,'points',q.points,'required',q.required,'group_name',q.group_name,
 'answer',k.answer,'accepted',coalesce(k.accepted,to_jsonb(k.answer)),'explanation',k.explanation,'evidence',k.evidence) order by q.position) into snap from public.questions q join public.answer_keys k on k.question_id=q.id where q.test_id=t;
 if snap is null then raise exception 'Test has no graded questions';end if;
 perform public.consume_quota(auth.uid(),'test',exam.kind);
 insert into public.test_attempts(user_id,test_id,expires_at,total,snapshot,material) values(auth.uid(),t,now()+make_interval(mins=>exam.duration),
 (select sum(coalesce((x->>'points')::int,1)) from jsonb_array_elements(snap) x),snap,jsonb_build_object('title',exam.title,'instructions',exam.instructions,'passage_title',exam.passage_title,'passage_text',exam.passage_text,'passage_image',exam.passage_image)) returning * into a;
 end if;
 return jsonb_build_object('id',a.id,'expires_at',a.expires_at,'answers',a.answers,'title',coalesce(a.material->>'title',exam.title),'instructions',coalesce(a.material->>'instructions',exam.instructions),'passage_title',coalesce(a.material->>'passage_title',exam.passage_title),'passage_text',coalesce(a.material->>'passage_text',exam.passage_text),'passage_image',coalesce(a.material->>'passage_image',exam.passage_image),
 'questions',(select jsonb_agg(x-array['answer','accepted','explanation','evidence']) from jsonb_array_elements(a.snapshot) x));
end$$;

