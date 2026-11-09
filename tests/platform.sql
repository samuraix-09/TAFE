-- Temporary fixtures. The final ROLLBACK removes all test users, content and usage.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('c1000000-0000-4000-8000-000000000001','{"display_name":"Transaction admin"}'),
 ('c1000000-0000-4000-8000-000000000002','{"display_name":"Transaction student"}'),
 ('c1000000-0000-4000-8000-000000000003','{"display_name":"Transaction other"}');
insert into public.user_roles values('c1000000-0000-4000-8000-000000000001','admin');
insert into public.plans(id,name,active,ai_daily,ai_monthly,tests_daily,tests_monthly,library_rank,permissions) values
 ('c2000000-0000-4000-8000-000000000001','Transaction QA plan',true,1,1,2,2,1,'{"ask":true,"full_mock":true}');
insert into public.subscriptions(user_id,plan_id,expires_at) values
 ('c1000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001',now()+interval '1 day');
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
do $$declare tid uuid;cat uuid;begin
select id into cat from public.exam_categories limit 1;
tid:=public.admin_save_test(jsonb_build_object('id','c3000000-0000-4000-8000-000000000001','title','Transaction QA exam','category_id',cat,'duration',10,'published',true,'questions','[
{"id":"c4000000-0000-4000-8000-000000000001","type":"multiple_choice","prompt":"One","options":["A","B"],"accepted":"A","points":2,"evidence":"The passage states A."},
{"id":"c4000000-0000-4000-8000-000000000002","type":"multiple_select","prompt":"Two","options":["A","B","C"],"accepted":["A","B"],"points":3},
{"id":"c4000000-0000-4000-8000-000000000003","type":"short_answer","prompt":"Three","options":[],"accepted":["Accepted answer"],"points":2},
{"id":"c4000000-0000-4000-8000-000000000004","type":"matching_features","prompt":"Four","options":["X","Y"],"config":{"rows":[{"id":"left","label":"Left item"}]},"accepted":{"left":"X"},"points":4},
{"id":"c4000000-0000-4000-8000-000000000005","type":"numeric_answer","prompt":"Five","options":[],"accepted":["4"],"points":2}
]'::jsonb));
if tid is null then raise exception 'Visual test save failed';end if;
tid:=public.admin_save_test(jsonb_build_object('title','Details-only draft','category_id',cat,'duration',30,'published',false,'questions','[]'::jsonb));
if not exists(select 1 from public.tests where id=tid and not published) then raise exception 'Details-only draft did not persist';end if;
begin
 perform public.admin_save_test(jsonb_build_object('title','Empty published test','category_id',cat,'duration',30,'published',true,'questions','[]'::jsonb));
 raise exception 'Published a test without questions';
exception when raise_exception then
 if SQLERRM='Published a test without questions' then raise;end if;
end;

begin perform public.admin_account_action('c1000000-0000-4000-8000-000000000001','suspend');raise exception 'Self-suspension accepted';exception when raise_exception then if SQLERRM='Self-suspension accepted' then raise;end if;end;
end$$;
insert into public.library_resources(id,title,published,access_rank) values
 ('c5000000-0000-4000-8000-000000000001','Transaction available',true,1),
 ('c5000000-0000-4000-8000-000000000002','Transaction restricted',true,2),
 ('c5000000-0000-4000-8000-000000000003','Transaction draft',false,0);
set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
do $$declare a jsonb;r jsonb;n integer;begin
if public.is_admin() then raise exception 'Student has admin role';end if;
begin
 perform public.admin_save_test('{}'::jsonb);
 raise exception 'Student could save a test';
exception when raise_exception then
 if SQLERRM<>'Admin authorization required' then raise;end if;
end;

begin perform public.admin_users();raise exception 'Unauthorized admin access';exception when raise_exception then if SQLERRM='Unauthorized admin access' then raise;end if;end;
begin perform snapshot from public.test_attempts;raise exception 'Snapshot exposed';exception when insufficient_privilege then null;end;
begin insert into public.user_roles values('c1000000-0000-4000-8000-000000000002','admin');raise exception 'Role modification allowed';exception when insufficient_privilege then null;end;
begin insert into public.subscriptions(user_id,plan_id,expires_at) values('c1000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001',now()+interval '1 day');raise exception 'Plan self-assignment allowed';exception when insufficient_privilege then null;end;
select count(*) into n from public.library_resources where id in ('c5000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000002','c5000000-0000-4000-8000-000000000003');
if n<>1 then raise exception 'Library entitlement filtering failed';end if;
a:=public.start_test('c3000000-0000-4000-8000-000000000001');
if (a->'questions'->0)?'accepted' or (a->'questions'->0)?'answer' then raise exception 'Keys exposed';end if;
if (a->'questions'->0)?'explanation' or (a->'questions'->0)?'evidence' then raise exception 'Explanation leaked before grading';end if;
begin perform public.attempt_review((a->>'id')::uuid);raise exception 'Active review allowed';exception when raise_exception then if SQLERRM='Active review allowed' then raise;end if;end;
r:=public.save_attempt((a->>'id')::uuid,'{
"c4000000-0000-4000-8000-000000000001":"A",
"c4000000-0000-4000-8000-000000000002":["B","A"],
"c4000000-0000-4000-8000-000000000003":"  ACCEPTED   ANSWER ",
"c4000000-0000-4000-8000-000000000004":{"left":"X"},
"c4000000-0000-4000-8000-000000000005":"4.00"
}',true);
if (r->>'score')::int<>13 or (r->>'total')::int<>13 then raise exception 'Advanced grading failed: %',r;end if;
r:=public.save_attempt((a->>'id')::uuid,'{}',true);if (r->>'score')::int<>13 then raise exception 'Idempotent submit failed';end if;
r:=public.attempt_review((a->>'id')::uuid);if r->'questions'->0->'accepted' is null then raise exception 'Completed review missing';end if;
if r->'questions'->0->>'evidence' is distinct from 'The passage states A.' then raise exception 'Completed review evidence missing';end if;
a:=public.start_test('c3000000-0000-4000-8000-000000000001');
r:=public.start_test('c3000000-0000-4000-8000-000000000001');if r->>'id'<>a->>'id' then raise exception 'Resume duplicate attempt';end if;
perform public.save_attempt((a->>'id')::uuid,'{}',true);
begin perform public.start_test('c3000000-0000-4000-8000-000000000001');raise exception 'Test limit bypass';exception when raise_exception then if SQLERRM='Test limit bypass' then raise;end if;end;
r:=public.my_entitlements();if (r->>'daily_test')::int<>2 then raise exception 'Usage tracking failed';end if;
end$$;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000003',true);
do $$begin if exists(select 1 from public.test_attempts where user_id='c1000000-0000-4000-8000-000000000002') then raise exception 'Cross-user attempts exposed';end if;end$$;
reset role;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
select public.admin_account_action('c1000000-0000-4000-8000-000000000002','suspend');
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$begin
if public.account_active(auth.uid()) then raise exception 'Suspension not applied';end if;
if exists(select 1 from public.test_attempts) then raise exception 'Suspended user sees attempts';end if;
begin perform public.start_test('c3000000-0000-4000-8000-000000000001');raise exception 'Suspended account accessed test';exception when raise_exception then if SQLERRM='Suspended account accessed test' then raise;end if;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
select public.admin_account_action('c1000000-0000-4000-8000-000000000002','reactivate');
insert into public.ai_conversations(id,user_id) values('c6000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002');
do $$declare r jsonb;begin
r:=public.begin_ai_request('c1000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001','ask','Transaction test');
if r->>'status'<>'started' then raise exception 'AI quota reservation failed';end if;
r:=public.begin_ai_request('c1000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001','ask','Transaction test');
if r->>'status'<>'pending' then raise exception 'Duplicate AI request not recognized';end if;
perform public.finish_ai_request('c7000000-0000-4000-8000-000000000001','Transaction test response',12);
begin perform public.begin_ai_request('c1000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000002','ask','Transaction test');raise exception 'AI limit bypass';exception when raise_exception then if SQLERRM='AI limit bypass' then raise;end if;end;
if not exists(select 1 from public.audit_logs where entity='profiles' and entity_id='c1000000-0000-4000-8000-000000000002') then raise exception 'Audit missing';end if;
if public.answer_matches('numeric_answer','"NaN"','["NaN"]') then raise exception 'Nonfinite numeric accepted';end if;
end$$;

do $$begin
if not public.answer_matches('true_false_not_given','"True"','"True"') then raise exception 'TFNG grading failed';end if;
if not public.answer_matches('yes_no_not_given','"Not Given"','"Not Given"') then raise exception 'YNNG grading failed';end if;
if not public.answer_matches('fill_blanks','{"slot":"HELLO"}','{"slot":["hello","hi"]}') then raise exception 'Completion grading failed';end if;
if public.answer_matches('fill_blanks','{"slot":"wrong"}','{"slot":["hello"]}') then raise exception 'Wrong completion graded correct';end if;
if not public.answer_matches('numeric_answer','" 4.00 "','["4"]') then raise exception 'Numeric whitespace normalization failed';end if;
if public.answer_matches('multiple_select','["A","B","C"]','["A","B"]') then raise exception 'Extra choice accepted';end if;
end$$;
select public.admin_account_action('c1000000-0000-4000-8000-000000000002','delete');
do $$begin
if public.account_active('c1000000-0000-4000-8000-000000000002') then raise exception 'Soft deletion did not disable account';end if;
if not exists(select 1 from public.test_attempts where user_id='c1000000-0000-4000-8000-000000000002') then raise exception 'Soft deletion unexpectedly destroyed history';end if;
end$$;
select public.admin_account_action('c1000000-0000-4000-8000-000000000002','reactivate');
update public.subscriptions set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where user_id='c1000000-0000-4000-8000-000000000002';
do $$begin if not (public.entitlement('c1000000-0000-4000-8000-000000000002')).is_default then raise exception 'Expired plan did not fall back';end if;end$$;
update public.subscriptions set starts_at=now(),expires_at=now()+interval '1 day',status='cancelled' where user_id='c1000000-0000-4000-8000-000000000002';
do $$begin if not (public.entitlement('c1000000-0000-4000-8000-000000000002')).is_default then raise exception 'Cancelled plan did not fall back';end if;end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
do $$declare changed integer;begin
begin update public.profiles set status='active' where id=auth.uid();raise exception 'User changed protected status';exception when insufficient_privilege then null;end;
update public.profiles set display_name='Unauthorized' where id='c1000000-0000-4000-8000-000000000003';get diagnostics changed=ROW_COUNT;if changed<>0 then raise exception 'Cross-user profile update allowed';end if;
begin insert into public.ai_messages(conversation_id,role,content) values('c6000000-0000-4000-8000-000000000001','assistant','Unauthorized');raise exception 'Client forged AI output';exception when insufficient_privilege then null;end;
end$$;
reset role;

insert into public.ai_requests(id,user_id,conversation_id,usage_id)
select 'c7000000-0000-4000-8000-000000000099','c1000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001',usage_id from public.ai_requests where id='c7000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin
begin perform public.delete_conversation('c6000000-0000-4000-8000-000000000001');raise exception 'Deleted running conversation';exception when raise_exception then if SQLERRM='Deleted running conversation' then raise;end if;end;
end$$;
reset role;
update public.ai_requests set status='failed' where id='c7000000-0000-4000-8000-000000000099';
set local role authenticated;
select public.delete_conversation('c6000000-0000-4000-8000-000000000001');
do $$begin if exists(select 1 from public.ai_conversations where id='c6000000-0000-4000-8000-000000000001') then raise exception 'Conversation not deleted';end if;end$$;
reset role;
select 'platform transaction assertions passed' as result;
rollback;
