-- Temporary fixtures. The final ROLLBACK removes all test users, content and usage.
begin;
do $$
begin
  if exists (
    select 1 from public.tests
    where id = 'fe816150-8c12-4b3a-b04a-000000000002' and published
  ) then
    raise exception 'Retired introductory diagnostic remains published';
  end if;
end $$;
-- Reuse the small historical form as an isolated timer fixture.
update public.tests set published = true
where id = 'fe816150-8c12-4b3a-b04a-000000000002';
do $$
declare item record;
begin
  for item in select * from (values
    ('sat', 'SAT Reading and Writing · Module 1', 32, 27),
    ('sat', 'SAT Reading and Writing · Module 2', 32, 27),
    ('sat', 'SAT Math · Module 1', 35, 22),
    ('sat', 'SAT Math · Module 2', 35, 22),
    ('ielts', 'IELTS Academic Reading · Practice Set 1', 60, 40)
  ) as expected(slug, title, minutes, questions) loop
    if not exists (
      select 1 from public.tests t
      join public.exam_categories c on c.id = t.category_id
      join public.questions q on q.test_id = t.id
      join public.answer_keys k on k.question_id = q.id
      where t.title = item.title and c.slug = item.slug
        and t.duration = item.minutes and t.published
      group by t.id
      having count(*) = item.questions and bool_and(
        case when q.type = 'numeric_answer' then jsonb_typeof(k.accepted) = 'array'
        else q.options @> jsonb_build_array(k.accepted) end
      )
    ) then raise exception 'Invalid practice set: %', item.title;
    end if;
  end loop;
end $$;
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
begin
 perform public.practice_attempt_question((a->>'id')::uuid,'c4000000-0000-4000-8000-000000000001','"A"');
 raise exception 'Active attempt could be graded as practice';
exception when raise_exception then
 if sqlerrm<>'Question unavailable' then raise; end if;
end;

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
if public.practice_attempt_question((a->>'id')::uuid,'c4000000-0000-4000-8000-000000000001','"B"')->>'correct'<>'false'
  or public.practice_attempt_question((a->>'id')::uuid,'c4000000-0000-4000-8000-000000000001','"A"')->>'correct'<>'true'
then raise exception 'Retry verdict did not use exam grader'; end if;
perform set_config('qa.review_attempt',(a->>'id'),true);

if r->'questions'->0->>'evidence' is distinct from 'The passage states A.' then raise exception 'Completed review evidence missing';end if;
a:=public.start_test('c3000000-0000-4000-8000-000000000001');
r:=public.start_test('c3000000-0000-4000-8000-000000000001');if r->>'id'<>a->>'id' then raise exception 'Resume duplicate attempt';end if;
perform public.save_attempt((a->>'id')::uuid,'{}',true);
begin perform public.start_test('c3000000-0000-4000-8000-000000000001');raise exception 'Test limit bypass';exception when raise_exception then if SQLERRM='Test limit bypass' then raise;end if;end;
r:=public.my_entitlements();if (r->>'daily_test')::int<>2 then raise exception 'Usage tracking failed';end if;
end$$;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000003',true);
do $$begin if exists(select 1 from public.test_attempts where user_id='c1000000-0000-4000-8000-000000000002') then raise exception 'Cross-user attempts exposed';end if;end$$;
do $$begin
 begin
  perform public.practice_attempt_question(current_setting('qa.review_attempt')::uuid,'c4000000-0000-4000-8000-000000000001','"A"');
  raise exception 'Practice allowed on another account';
 exception when raise_exception then
  if sqlerrm<>'Question unavailable' then raise; end if;
 end;
end$$;

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
insert into auth.users(id,raw_user_meta_data) values
 ('c1000000-0000-4000-8000-000000000004','{"display_name":"SAT transaction QA"}');
insert into public.subscriptions(user_id,plan_id,expires_at) values
 ('c1000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000001',now()+interval '1 day');

-- Keep expected content in this transaction only.
select set_config('qa.sat_correct',(
 select jsonb_object_agg(q.id,
  case when q.type='numeric_answer' then k.accepted->0 else k.accepted end)::text
 from public.sat_exam_modules m
 join public.questions q on q.test_id=m.source_id
 join public.answer_keys k on k.question_id=q.id
),true);
do $$begin
 if public.sat_numeric_answer(' 3/4 ')<>0.75 or public.sat_numeric_answer('−.25')<>-0.25
    or public.sat_numeric_answer('3/0') is not null then raise exception 'SAT numeric parsing failed'; end if;
end$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000004',true);
do $$
declare test uuid:='fe816150-8c12-4b3a-b04a-000000000001'; a jsonb; r jsonb; id uuid;
 expected jsonb:=current_setting('qa.sat_correct')::jsonb; answer_map jsonb; i int; item jsonb;
begin
 if (select count(*) from jsonb_array_elements(public.web_exam_catalog()) entry
     where entry->>'id' in ('fe816150-8c12-4b3a-b04a-000000000001','fe816150-8c12-4b3a-b04a-000000000002'))<>2
    or exists(select 1 from jsonb_array_elements(public.web_exam_catalog()) entry
     where entry->>'id' in ('e4b994df-8f8f-582a-bba2-e53c002d825a','9c4d7708-f642-5cca-9458-57c66aa2f1b7',
      'e74e5cb0-f8b8-5c37-bf33-7026c247b906','2b07157d-ac83-5713-9ee9-ea7e0329dc2d')) then
  raise exception 'SAT catalog did not hide stand-alone modules';
 end if;
 if exists(select 1 from public.tests where public.tests.id=test) then raise exception 'Legacy catalog exposed web-only SAT form'; end if;
 begin perform public.start_exam_session('e4b994df-8f8f-582a-bba2-e53c002d825a');raise exception 'Standalone module access allowed';
 exception when raise_exception then if SQLERRM='Standalone module access allowed' then raise;end if; end;
 a:=public.start_exam_session(test);
 id:=(a->>'id')::uuid;
 if (a->>'stage')::int<>0 or (a->>'stage_count')::int<>4 or jsonb_array_length(a->'questions')<>27
    or (a->'questions'->0)?'accepted' then raise exception 'Invalid initial module'; end if;
 if (public.start_exam_session(test)->>'id')::uuid<>id then raise exception 'Resume opened a duplicate'; end if;
 for i in 0..3 loop
  if (a->>'stage')::int<>i or jsonb_array_length(a->'questions')<>(case when i<2 then 27 else 22 end) then
    raise exception 'Incorrect module %',i;
  end if;
  select jsonb_object_agg(q->>'id',expected->(q->>'id')) into answer_map from jsonb_array_elements(a->'questions') q;
  if i=0 then
   r:=public.exam_session_action(id,answer_map,'leave',i);
   if (r->>'fullscreen_deadline')::timestamptz<(r->>'server_time')::timestamptz+interval '9 seconds' then raise exception 'Grace deadline missing'; end if;
   r:=public.exam_session_action(id,'{}','advance',i);
   if (r->>'stage')::int<>i or (select count(*) from jsonb_object_keys(r->'answers'))<>27 then raise exception 'Outside screen advanced the attempt'; end if;
   r:=public.exam_session_action(id,'{}','return',i);
   if r->>'fullscreen_deadline' is not null then raise exception 'Returning did not clear grace'; end if;
  end if;
  a:=public.exam_session_action(id,answer_map,'advance',i);
  if i<3 then
   r:=public.exam_session_action(id,'{}','advance',i);
   if (r->>'stage')::int<>i+1 then raise exception 'A repeated request skipped a module'; end if;
   if r->'answers'<>'{}'::jsonb then raise exception 'Answers from a locked module exposed'; end if;
  end if;
 end loop;
 if (a->>'submitted')::boolean is not true or (a->>'score')::int<>98 or (a->'sat_scores'->>'total')::int<>1600 then
  raise exception 'Full SAT scoring failed: %',a;
 end if;
 r:=public.attempt_review(id);
 if r->'sat_scores'->>'correct'<>'98' or r->'sat_scores'->>'unanswered'<>'0'
   or (r->'sat_scores'->>'accuracy')::numeric<>100 or jsonb_array_length(r->'questions')<>98 or exists(
  select 1 from jsonb_array_elements(r->'questions') x where not (x->>'correct')::boolean
 ) then raise exception 'SAT review omitted answers or sections'; end if;
 a:=public.start_exam_session('fe816150-8c12-4b3a-b04a-000000000002');
 id:=(a->>'id')::uuid;
 perform set_config('qa.diagnostic_id',id::text,true);
 item:=a->'questions'->0;
 r:=public.exam_session_action(id,jsonb_build_object(item->>'id',expected->(item->>'id')),'leave',0);
 r:=public.exam_session_action(id,jsonb_build_object(item->>'id','wrong'),'save',0);
 if r->'answers'->(item->>'id')<>expected->(item->>'id') then raise exception 'Answers changed outside fullscreen'; end if;
end$$;
reset role;
update public.test_attempts set fullscreen_deadline=clock_timestamp()-interval '1 hour',
 expires_at=clock_timestamp()-interval '40 minutes',
 module_expires_at=clock_timestamp()-interval '55 minutes'
where id=current_setting('qa.diagnostic_id')::uuid;
set local role authenticated;
do $$
declare id uuid:=current_setting('qa.diagnostic_id')::uuid;
 r jsonb; saved jsonb; paused timestamptz; old_end timestamptz; old_module_end timestamptz;
begin
 perform public.settle_exam_sessions();
 r:=public.exam_session_action(id,'{}','return',0);
 paused:=(r->>'paused_at')::timestamptz;
 old_end:=(r->>'expires_at')::timestamptz;
 old_module_end:=(r->>'module_expires_at')::timestamptz;
 saved:=r->'answers';
 if paused is null or (r->>'submitted')::boolean is not false
   or r->>'finish_reason' is not null or (select count(*) from jsonb_object_keys(saved))<>1 then
  raise exception 'Expired fullscreen should pause with saved answers: %',r;
 end if;
 r:=public.start_exam_session('fe816150-8c12-4b3a-b04a-000000000002');
 if r->>'id'<>id::text or (r->>'paused_at')::timestamptz<>paused then
  raise exception 'Resuming from the catalogue lost the paused attempt';
 end if;
 r:=public.exam_session_action(id,'{}','advance',0);
 if (r->>'stage')::int<>0 or r->'answers'<>saved or r->>'paused_at' is null then
  raise exception 'Paused session can still advance';
 end if;
 r:=public.exam_session_action(id,'{}','resume',0);
 if r->>'paused_at' is not null or r->'answers'<>saved
   or abs(extract(epoch from ((r->>'expires_at')::timestamptz-(r->>'server_time')::timestamptz)-(old_end-paused)))>1
   or abs(extract(epoch from ((r->>'module_expires_at')::timestamptz-(r->>'server_time')::timestamptz)-(old_module_end-paused)))>1 then
  raise exception 'Resume did not restore the frozen timers and answers';
 end if;
 perform public.exam_session_action(id,'{}','advance',0);
 perform public.exam_session_action(id,'{}','advance',1);
 perform public.exam_session_action(id,'{}','advance',2);
 r:=public.exam_session_action(id,'{}','advance',3);
 if (r->>'submitted')::boolean is not true or r->>'finish_reason'<>'submitted'
    or (r->>'score')::int<>1 then raise exception 'Completed attempt lost its pre-pause result'; end if;
end$$;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000003',true);
do $$begin
 begin perform public.exam_session_action(current_setting('qa.diagnostic_id')::uuid,'{}','status',0);
 raise exception 'Cross-user session access allowed';
 exception when raise_exception then if SQLERRM='Cross-user session access allowed' then raise;end if; end;
end$$;
reset role;

do $$
begin
 if not exists (
  select 1 from public.tests t join public.exam_categories c on c.id=t.category_id
  join public.questions q on q.test_id=t.id join public.answer_keys k on k.question_id=q.id
  where t.id='fe816150-8c12-4b3a-b04a-000000000011' and t.published and c.slug='cefr' and t.duration=20
  group by t.id having count(*)=12 and count(distinct q.group_name)=2
    and bool_and(q.options @> jsonb_build_array(k.accepted))
 ) then raise exception 'CEFR Reading practice fixture is incomplete'; end if;
end
$$;
-- SAT scoring revisions are authorized, pinned, and stable across finish retries and history reads.
update public.plans set tests_daily=4,tests_monthly=4 where id='c2000000-0000-4000-8000-000000000001';
insert into auth.users(id,raw_user_meta_data) values
 ('c1000000-0000-4000-8000-000000000005','{"display_name":"SAT score QA"}');
insert into public.subscriptions(user_id,plan_id,expires_at) values
 ('c1000000-0000-4000-8000-000000000005','c2000000-0000-4000-8000-000000000001',now()+interval '1 day');
set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000005',true);
do $$
declare t uuid:='fe816150-8c12-4b3a-b04a-000000000001'; a jsonb; id uuid; r jsonb;
begin
  begin perform public.admin_sat_scoring(t); raise exception 'Student read model';
  exception when raise_exception then if sqlerrm<>'Administrator required' then raise; end if; end;
  begin perform public.admin_save_sat_scoring(t,1,'Invalid',array[200,800],array[200,800]);
  exception when raise_exception then if sqlerrm<>'Administrator required' then raise; end if; end;
  if has_table_privilege('public.sat_scoring_models','SELECT')
    or has_column_privilege('public.test_attempts','sat_question_results','SELECT') then
    raise exception 'Private scoring data exposed by table grants';
  end if;

  a:=public.start_exam_session(t);
  id:=(a->>'id')::uuid;
  if a ? 'sat_scoring' or a->'questions'->0 ? 'accepted' then raise exception 'Private payload leaked'; end if;
  for i in 0..3 loop
    select jsonb_object_agg(q->>'id','"not an answer"'::jsonb) into r from jsonb_array_elements(a->'questions') q;
    a:=public.exam_session_action(id,r,'advance',i);
  end loop;
  r:=a->'sat_scores';
  if r->>'total'<>'400' or r->>'correct'<>'0' or r->>'incorrect'<>'98' or r->>'unanswered'<>'0'
    or r->>'model_revision'<>'1' or (r->>'accuracy')::numeric<>0 then
    raise exception 'All-incorrect SAT aggregate is wrong: %', r;
  end if;

  a:=public.start_exam_session(t);
  perform set_config('qa.scored_attempt',a->>'id',true);
  begin perform public.attempt_review((a->>'id')::uuid); raise exception 'Active SAT result readable';
  exception when raise_exception then if sqlerrm<>'Completed attempt required' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
do $$
declare t uuid:='fe816150-8c12-4b3a-b04a-000000000001'; s jsonb; c1 int[]; c2 int[];
begin
  s:=public.admin_sat_scoring(t);
  if s->'counts' <> '{"reading_writing":54,"math":44}'::jsonb then raise exception 'Incorrect table dimensions'; end if;
  if s->'model'->'reading_writing'->>20<>'410' or s->'model'->'math'->>35<>'650' then
    raise exception 'Unexpected nonlinear conversions';
  end if;
  begin perform public.admin_save_sat_scoring(t,1,'Invalid',array[200,800],array[200,800]);
    raise exception 'Invalid conversion accepted';
  exception when raise_exception then if sqlerrm not like 'Each scoring table%' then raise; end if; end;
  select array_agg(case when i=1 then 200 when i=55 then 800 else 500 end order by i) into c1 from generate_series(1,55) i;
  select array_agg(case when i=1 then 200 when i=45 then 800 else 600 end order by i) into c2 from generate_series(1,45) i;
  s:=public.admin_save_sat_scoring(t,1,'QA alternative curve',c1,c2);
  if s->'model'->>'revision'<>'2' then raise exception 'Admin did not save revision'; end if;
  if public.admin_sat_scoring('fe816150-8c12-4b3a-b04a-000000000002')->'model'<>'null'::jsonb then
    raise exception 'One form affected another';
  end if;
  begin perform public.admin_save_sat_scoring(t,1,'Stale edit',c1,c2);
    raise exception 'Stale model revision was accepted';
  exception when raise_exception then if sqlerrm<>'Scoring revision changed. Reload the form.' then raise; end if; end;
end $$;

reset role;
update public.test_attempts set started_at=clock_timestamp()-interval '90 seconds',
 paused_duration=interval '60 seconds' where id=current_setting('qa.scored_attempt')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000005',true);
do $$
declare t uuid:='fe816150-8c12-4b3a-b04a-000000000001'; id uuid:=current_setting('qa.scored_attempt')::uuid;
  a jsonb; review jsonb; retry jsonb; results jsonb; answer_map jsonb;
  expected jsonb:=current_setting('qa.sat_correct')::jsonb;
begin
  a:=public.start_exam_session(t);
  if (a->>'id')::uuid<>id then raise exception 'Active attempt was recreated'; end if;
  for i in 0..3 loop
    select coalesce(jsonb_object_agg(q->>'id',case
      when i=0 and ord=21 then '"   "'::jsonb
      else expected->(q->>'id') end),'{}'::jsonb) into answer_map
    from jsonb_array_elements(a->'questions') with ordinality as e(q,ord)
    where (i=0 and ord<=21) or i=2 or (i=3 and ord<=13);
    a:=public.exam_session_action(id,answer_map,'advance',i);
  end loop;
  results:=a->'sat_scores';
  if results->>'model_revision'<>'1' or results->>'total'<>'1060' or results->>'correct'<>'55'
    or results->>'unanswered'<>'43' or results->>'incorrect'<>'0' or (results->>'accuracy')::numeric<>56.1
    or results->'reading_writing'->>'scaled'<>'410' or results->'math'->>'scaled'<>'650'
    or (results->>'duration_seconds')::int not between 29 and 40 then
    raise exception 'Pinned mixed SAT results are wrong: %',results;
  end if;
  review:=public.attempt_review(id);
  retry:=public.exam_session_action(id,'{}','advance',3);
  perform public.settle_exam_sessions();
  if retry->'sat_scores' is distinct from results or review is distinct from public.attempt_review(id)
    or (select count(*) from public.test_attempts where test_id=t and submitted_at is not null)<>2
    or jsonb_array_length(review->'questions')<>98 or
       (select count(*) from jsonb_array_elements(review->'questions') q where q->>'status'='missing')<>43
    or (select sum((item->>'questions')::int) from jsonb_array_elements(results->'breakdown') item)<>98
    or exists(select 1 from jsonb_array_elements(results->'breakdown') item where item->>'topic' is null) then
    raise exception 'SAT history, question details, or topic breakdown inconsistent';
  end if;
end $$;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000004',true);
do $$
declare a jsonb; id uuid; t uuid:='fe816150-8c12-4b3a-b04a-000000000001';
  expected jsonb:=current_setting('qa.sat_correct')::jsonb; item jsonb;
begin
  begin perform public.attempt_review(current_setting('qa.scored_attempt')::uuid);
    raise exception 'Cross-user SAT report readable';
  exception when raise_exception then if sqlerrm<>'Completed attempt required' then raise; end if; end;
  a:=public.start_exam_session(t);
  id:=(a->>'id')::uuid;
  for i in 0..3 loop
    item:=a->'questions'->0;
    a:=public.exam_session_action(id,jsonb_build_object(item->>'id',expected->(item->>'id')),'advance',i);
  end loop;
  if a->'sat_scores'->>'total'<>'1100' or a->'sat_scores'->>'model_revision'<>'2' then
    raise exception 'New attempt ignored the assigned conversion revision';
  end if;
end $$;
reset role;

select 'platform transaction assertions passed' as result;
rollback;
