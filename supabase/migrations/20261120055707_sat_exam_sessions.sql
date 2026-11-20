alter table public.tests
  add column sat_module_source boolean not null default false,
  add column sat_session_form boolean not null default false;
alter table public.test_attempts
  add column exam_stage integer,
  add column module_expires_at timestamptz,
  add column fullscreen_deadline timestamptz,
  add column finish_reason text,
  add column sat_scores jsonb;
grant select(finish_reason,sat_scores) on public.test_attempts to authenticated;

create table public.sat_exam_modules (
  test_id uuid not null references public.tests on delete cascade,
  stage integer not null check(stage between 0 and 3),
  source_id uuid not null references public.tests,
  section text not null check(section in ('reading_writing','math')),
  minutes integer not null check(minutes between 1 and 60),
  primary key(test_id,stage)
);
alter table public.sat_exam_modules enable row level security;
revoke all on public.sat_exam_modules from public,anon,authenticated;

insert into public.tests(id,category_id,title,section,duration,published,description,instructions,sat_session_form)
select forms.id,c.id,forms.title,forms.section,forms.minutes,true,forms.description,forms.instructions,true
from public.exam_categories c cross join (values
 ('fe816150-8c12-4b3a-b04a-000000000001'::uuid,'SAT · Full Practice','Reading and Writing + Math',134,
  '98 questions across four timed modules. One result for the entire test.',
  'Complete both Reading and Writing modules, then both Math modules. Earlier modules lock when you move on.'),
 ('fe816150-8c12-4b3a-b04a-000000000002'::uuid,'SAT · Boshlang‘ich sinov','Diagnostic',20,
  '16 original questions across four short modules. Review skills and answers to plan your preparation.',
  'Complete the modules in order. Use the answer explanations to identify skills to practise.')
) as forms(id,title,section,minutes,description,instructions)
where c.slug='sat'
on conflict(id) do nothing;

update public.tests set sat_module_source=true where id in (
 'e4b994df-8f8f-582a-bba2-e53c002d825a','9c4d7708-f642-5cca-9458-57c66aa2f1b7',
 'e74e5cb0-f8b8-5c37-bf33-7026c247b906','2b07157d-ac83-5713-9ee9-ea7e0329dc2d'
);

insert into public.sat_exam_modules(test_id,stage,source_id,section,minutes) values
 ('fe816150-8c12-4b3a-b04a-000000000001',0,'e4b994df-8f8f-582a-bba2-e53c002d825a','reading_writing',32),
 ('fe816150-8c12-4b3a-b04a-000000000001',1,'9c4d7708-f642-5cca-9458-57c66aa2f1b7','reading_writing',32),
 ('fe816150-8c12-4b3a-b04a-000000000001',2,'e74e5cb0-f8b8-5c37-bf33-7026c247b906','math',35),
 ('fe816150-8c12-4b3a-b04a-000000000001',3,'2b07157d-ac83-5713-9ee9-ea7e0329dc2d','math',35),
 ('fe816150-8c12-4b3a-b04a-000000000002',0,'fe816150-8c12-4b3a-b04a-000000000002','reading_writing',5),
 ('fe816150-8c12-4b3a-b04a-000000000002',1,'fe816150-8c12-4b3a-b04a-000000000002','reading_writing',5),
 ('fe816150-8c12-4b3a-b04a-000000000002',2,'fe816150-8c12-4b3a-b04a-000000000002','math',5),
 ('fe816150-8c12-4b3a-b04a-000000000002',3,'fe816150-8c12-4b3a-b04a-000000000002','math',5);

do $diagnostic$
declare q record; qid uuid;
begin
  for q in select * from (values
    (0,'Words in Context','Although some researchers were skeptical at first, the second experiment substantiated the initial finding. What does “substantiated” mean here?',array['Confirmed','Weakened','Predicted','Replaced'],1,'The second experiment provided evidence for the initial finding.'),
    (1,'Main Ideas','A garden replaced its uniform planting beds with a mix of native species. Two years later, it supported twice as many kinds of pollinating insects. Which statement best summarizes the text?',array['Native planting increased pollinator diversity.','The garden doubled in area.','All insects prefer one plant species.','The garden removed its native plants.'],1,'The reported change is an increase in kinds of pollinators after native planting.'),
    (2,'Transitions','The first route is shorter. _____, the second route has fewer steep climbs, so it is easier for beginners.',array['Therefore','For instance','However','Similarly'],3,'However marks the contrast between distance and difficulty.'),
    (3,'Sentence Boundaries','Which choice completes the sentence? The records were incomplete _____ the team consulted a second archive.',array[', the','; the',' the',': and the'],2,'A semicolon can join two related independent clauses.'),
    (4,'Inference','After the library moved its evening workshops online, attendance increased, especially among readers who lived far away. Which inference is most supported?',array['Distance may have limited earlier attendance.','People living nearby stopped using the library.','The number of workshops fell.','Online workshops were shorter.'],1,'The strongest increase occurred among readers who had farther to travel.'),
    (5,'Rhetorical Synthesis','A student wants to contrast two materials. Linen absorbs water quickly and dries slowly. Nylon absorbs less water and dries quickly. Which sentence best accomplishes the goal?',array['Linen and nylon are both materials.','Unlike linen, nylon dries quickly.','Linen absorbs water quickly.','Nylon was studied alongside linen.'],2,'The answer explicitly contrasts their drying rates.'),
    (6,'Subject–Verb Agreement','Which choice completes the sentence? The collection of handwritten letters _____ a rare view of the expedition.',array['provide','have provided','provides','were providing'],3,'The singular subject is “collection,” so it takes “provides.”'),
    (7,'Textual Evidence','A survey found that 61% of students preferred four short practices a week and 24% preferred one long practice. Which choice accurately uses the data?',array['A majority preferred one long practice.','Four short practices were preferred by more than half.','Both options received equal support.','Only 24% preferred short practices.'],2,'61% is more than half.'),
    (8,'Algebra','If 4x − 7 = 17, what is x?',array['4','5','6','7'],3,'Add 7 to both sides and divide 24 by 4.'),
    (9,'Linear Functions','A line passes through (2, 5) and (6, 13). What is its slope?',array['1','2','3','4'],2,'The slope is (13 − 5) ÷ (6 − 2) = 2.'),
    (10,'Percentages','A price of $80 is reduced by 15%. What is the new price?',array['$65','$68','$72','$76'],2,'The new price is 0.85 × 80 = 68.'),
    (11,'Geometry','A right triangle has legs of lengths 9 and 12. What is its hypotenuse?',array['13','14','15','21'],3,'The Pythagorean theorem gives √(81 + 144) = 15.'),
    (12,'Quadratics','What is the greater solution of x² − 9x + 20 = 0?',array['4','5','9','20'],2,'Factoring gives (x − 4)(x − 5) = 0.'),
    (13,'Ratios','A mixture uses 3 parts juice for every 5 parts water. How many liters of juice are in a 24-liter mixture?',array['8','9','12','15'],2,'Juice is 3/8 of 24 liters.'),
    (14,'Data Analysis','The mean of 4, 6, 10, and k is 8. What is k?',array['8','10','12','14'],3,'A mean of 8 requires a total of 32. The known values sum to 20.'),
    (15,'Systems of Equations','If 2x + y = 11 and x − y = 1, what is x?',array['2','3','4','5'],3,'Adding the equations gives 3x = 12.')
  ) as items(position,skill,prompt,options,key,explanation) loop
    insert into public.questions(test_id,prompt,options,position,group_name)
    values('fe816150-8c12-4b3a-b04a-000000000002',q.prompt,to_jsonb(q.options),q.position,q.skill)
    returning id into qid;
    insert into public.answer_keys(question_id,answer,accepted,explanation)
    values(qid,q.options[q.key],to_jsonb(q.options[q.key]),q.explanation);
  end loop;
end
$diagnostic$;

-- Keep the legacy client catalog and attempt API compatible with existing Android builds.
drop policy tests_read on public.tests;
create policy tests_read on public.tests for select to authenticated using(
 public.is_admin() or (public.can_access_test(auth.uid(),id) and (not sat_session_form or
 exists(select 1 from public.test_attempts a where a.test_id=tests.id and a.user_id=auth.uid())))
);
create function public.web_exam_catalog() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'kind',t.kind,
  'description',t.description,'section',t.section,'duration',t.duration,'difficulty',t.difficulty,
  'diagnostic',t.sat_session_form and t.section='Diagnostic','exam_categories',jsonb_build_object('name',c.name))
  order by (t.sat_session_form and t.section='Diagnostic') desc,t.created_at desc,t.id),'[]'::jsonb)
 from public.tests t join public.exam_categories c on c.id=t.category_id
 where t.published and not t.sat_module_source and public.can_access_test(auth.uid(),t.id)
$$;
revoke all on function public.web_exam_catalog() from public,anon;
grant execute on function public.web_exam_catalog() to authenticated;

create function public.sat_numeric_answer(value text) returns numeric
language plpgsql immutable set search_path='' as $$
declare parts text[];
begin
 value:=replace(trim(value),'−','-');
 if length(value)>50 then return null; end if;
 parts:=regexp_match(value,'^([+-]?[0-9]+)[[:space:]]*/[[:space:]]*([0-9]+)$');
 if parts is not null then return parts[1]::numeric/nullif(parts[2]::numeric,0); end if;
 if value ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$' then return value::numeric; end if;
 return null;
end
$$;
revoke all on function public.sat_numeric_answer(text) from public,anon,authenticated;

create function public.exam_answer_correct(q jsonb,response jsonb) returns boolean
language sql immutable set search_path='' as $$
 select case when q ? 'sat_section' and q->>'type'='numeric_answer' then
  exists(select 1 from jsonb_array_elements_text(q->'accepted') key
    where public.sat_numeric_answer(response#>>'{}')=public.sat_numeric_answer(key))
 else coalesce(public.answer_matches(coalesce(q->>'type','multiple_choice'),response,
    coalesce(q->'accepted',to_jsonb(q->>'answer'))),false) end
$$;
revoke all on function public.exam_answer_correct(jsonb,jsonb) from public,anon,authenticated;

create function public.exam_session_payload(a public.test_attempts, exam public.tests)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'id',a.id,'expires_at',a.expires_at,'module_expires_at',a.module_expires_at,
    'fullscreen_deadline',a.fullscreen_deadline,'server_time',clock_timestamp(),
    'stage',a.exam_stage,'stage_count',a.material->'stage_count',
    'estimate',a.material->'estimate','submitted',a.submitted_at is not null,
    'finish_reason',a.finish_reason,'score',a.score,'total',a.total,'sat_scores',a.sat_scores,
    'answers',coalesce((select jsonb_object_agg(x->>'id',a.answers->(x->>'id'))
      from jsonb_array_elements(a.snapshot) x
      where (a.exam_stage is null or (x->>'stage')::int=a.exam_stage)
        and a.answers ? (x->>'id')),'{}'::jsonb),
    'title',coalesce(a.material->>'title',exam.title),
    'instructions',coalesce(a.material->>'instructions',exam.instructions),
    'passage_title',coalesce(a.material->>'passage_title',exam.passage_title),
    'passage_text',coalesce(a.material->>'passage_text',exam.passage_text),
    'passage_image',coalesce(a.material->>'passage_image',exam.passage_image),
    'questions',coalesce((select jsonb_agg(x-array['answer','accepted','explanation','evidence'] order by ord)
      from jsonb_array_elements(a.snapshot) with ordinality as snapshot(x,ord)
      where a.submitted_at is null and (a.exam_stage is null or (x->>'stage')::int=a.exam_stage)),'[]'::jsonb)
  );
$$;
revoke all on function public.exam_session_payload(public.test_attempts,public.tests) from public,anon,authenticated;

create function public.finalize_exam_session(a public.test_attempts, reason text)
returns public.test_attempts language plpgsql set search_path='' as $$
declare earned int; stats jsonb;
begin
 if a.submitted_at is not null then return a; end if;
 with graded as (
   select x->>'sat_section' as section,coalesce((x->>'points')::int,1) points,
    public.exam_answer_correct(x,a.answers->(x->>'id')) correct
   from jsonb_array_elements(a.snapshot) x
 ), sections as (
   select section,count(*)::int items,count(*) filter(where correct)::int correct,
     (200+10*round(60.0*(count(*) filter(where correct))/count(*)))::int scaled
   from graded where section is not null group by section
 )
 select (select coalesce(sum(case when a.exam_stage is not null then 1 else points end)
  filter(where correct),0) from graded),
  (select jsonb_object_agg(section,jsonb_build_object('correct',correct,'questions',items,'scaled',scaled))
   from sections)
 into earned,stats;

 if stats is not null then
   stats:=stats||jsonb_build_object('method','tafe_practice_v1');
   if (a.material->>'estimate')::boolean then
     stats:=stats||jsonb_build_object('total',(stats->'math'->>'scaled')::int+(stats->'reading_writing'->>'scaled')::int);
   end if;
 end if;
 update public.test_attempts set answers=a.answers,submitted_at=clock_timestamp(),score=earned,
   sat_scores=stats,finish_reason=reason,fullscreen_deadline=null where id=a.id returning * into a;
 return a;
end
$$;
revoke all on function public.finalize_exam_session(public.test_attempts,text) from public,anon,authenticated;

create function public.open_exam_session(t uuid,web_session boolean) returns jsonb
language plpgsql set search_path='' as $$
declare a public.test_attempts; exam public.tests; snap jsonb; material jsonb; modules int; first_minutes int;
begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||t::text,0));
 select * into exam from public.tests where id=t and published;
 if not found then raise exception 'Test unavailable'; end if;
 if not public.can_access_test(auth.uid(),t) then raise exception 'Your plan does not include this test'; end if;
 if exam.sat_session_form and not web_session then raise exception 'Open this SAT test in the TAFE web app'; end if;
 select * into a from public.test_attempts where user_id=auth.uid() and test_id=t and submitted_at is null for update;
 if found then
   if a.fullscreen_deadline<=clock_timestamp() then a:=public.finalize_exam_session(a,'fullscreen');
   elsif a.expires_at<=clock_timestamp() then a:=public.finalize_exam_session(a,'time');
   end if;
   return public.exam_session_payload(a,exam);
 end if;
 if web_session and exam.sat_module_source then raise exception 'This module is part of the full SAT practice test'; end if;

 select count(*),min(minutes) filter(where stage=0) into modules,first_minutes
 from public.sat_exam_modules where test_id=t;
 material:=jsonb_build_object('title',exam.title,'instructions',exam.instructions,'passage_title',exam.passage_title,
  'passage_text',exam.passage_text,'passage_image',exam.passage_image);
 if modules>0 then
   material:=material||jsonb_build_object('stage_count',modules,'estimate',t='fe816150-8c12-4b3a-b04a-000000000001',
     'stage_minutes',(select jsonb_agg(minutes order by stage) from public.sat_exam_modules where test_id=t));
 end if;
 select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',q.id,'prompt',q.prompt,'options',q.options,'type',q.type,
  'config',q.config,'points',case when m.stage is null then q.points else 1 end,'required',q.required,'group_name',q.group_name,
  'stage',m.stage,'sat_section',m.section,'answer',k.answer,'accepted',coalesce(k.accepted,to_jsonb(k.answer)),
  'explanation',k.explanation,'evidence',k.evidence)) order by m.stage,q.position,q.id)
 into snap
 from public.questions q join public.answer_keys k on k.question_id=q.id
 left join public.sat_exam_modules m on m.test_id=t and m.source_id=q.test_id and
   (m.source_id<>t or m.stage=q.position/4)
 where ((modules=0 and q.test_id=t) or m.stage is not null);
 if snap is null then raise exception 'Test has no graded questions'; end if;
 if modules>0 and (select count(distinct x->>'stage') from jsonb_array_elements(snap) x)<>modules then
   raise exception 'SAT practice has an empty module';
 end if;
 perform public.consume_quota(auth.uid(),'test',exam.kind);
 insert into public.test_attempts(user_id,test_id,expires_at,total,snapshot,material,exam_stage,module_expires_at)
 values(auth.uid(),t,clock_timestamp()+make_interval(mins=>exam.duration),
  (select sum(coalesce((x->>'points')::int,1)) from jsonb_array_elements(snap) x),snap,material,
  case when modules>0 then 0 end,clock_timestamp()+make_interval(mins=>first_minutes)) returning * into a;
 return public.exam_session_payload(a,exam);
end
$$;

revoke all on function public.open_exam_session(uuid,boolean) from public,anon,authenticated;
create or replace function public.start_test(t uuid) returns jsonb
language sql security definer set search_path='' as $$
 select public.open_exam_session(t,false)
$$;
create function public.start_exam_session(t uuid) returns jsonb
language sql security definer set search_path='' as $$
 select public.open_exam_session(t,true)
$$;
revoke all on function public.start_exam_session(uuid) from public,anon;
grant execute on function public.start_exam_session(uuid) to authenticated;

create function public.update_exam_session(attempt uuid, response jsonb, action text, expected_stage integer)
returns public.test_attempts language plpgsql set search_path='' as $$
declare a public.test_attempts; stamp timestamptz; current_answers jsonb; last_stage int; next_minutes int;
begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
 select * into a from public.test_attempts where id=attempt and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt unavailable'; end if;
 if a.submitted_at is not null then return a; end if;
 stamp:=clock_timestamp();
 if a.fullscreen_deadline<=stamp then return public.finalize_exam_session(a,'fullscreen'); end if;
 if a.expires_at<=stamp then return public.finalize_exam_session(a,'time'); end if;
 if a.exam_stage is distinct from expected_stage then return a; end if;
 if action='return' then
   update public.test_attempts set fullscreen_deadline=null where id=a.id returning * into a;
   return a;
 end if;
 if a.fullscreen_deadline is not null then return a; end if;
 if a.module_expires_at is null or a.module_expires_at>stamp then
   if response is null or jsonb_typeof(response)<>'object' or octet_length(response::text)>100000 then
     raise exception 'Invalid answers';
   end if;
   select coalesce(jsonb_object_agg(x->>'id',response->(x->>'id')),'{}'::jsonb) into current_answers
   from jsonb_array_elements(a.snapshot) x
   where (a.exam_stage is null or (x->>'stage')::int=a.exam_stage) and response ? (x->>'id');
   a.answers:=a.answers||current_answers;
 end if;
 if action='finish' then
   if a.exam_stage is not null then raise exception 'Complete the SAT modules in order'; end if;
   return public.finalize_exam_session(a,'submitted');
 end if;
 if a.exam_stage is not null and action='advance' then
   last_stage:=(a.material->>'stage_count')::int-1;
   if a.exam_stage=last_stage then return public.finalize_exam_session(a,'submitted'); end if;
   a.exam_stage:=a.exam_stage+1;
   next_minutes:=(a.material->'stage_minutes'->>a.exam_stage)::int;
   a.module_expires_at:=least(a.expires_at,stamp+make_interval(mins=>next_minutes));
 end if;
 if action='leave' then a.fullscreen_deadline:=stamp+interval '10 seconds'; end if;
 update public.test_attempts set answers=a.answers,exam_stage=a.exam_stage,
   module_expires_at=a.module_expires_at,fullscreen_deadline=a.fullscreen_deadline
 where id=a.id returning * into a;
 return a;
end
$$;
revoke all on function public.update_exam_session(uuid,jsonb,text,integer) from public,anon,authenticated;

create or replace function public.save_attempt(attempt uuid,response jsonb,finish boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts;
begin
 a:=public.update_exam_session(attempt,response,case when finish then 'finish' else 'save' end,null);
 return jsonb_build_object('submitted',a.submitted_at is not null,'score',a.score,'total',a.total);
end
$$;

create function public.exam_session_action(attempt uuid,response jsonb,action text,stage integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; exam public.tests;
begin
 if action is null or action not in ('save','finish','advance','leave','return','status') then raise exception 'Invalid action'; end if;
 a:=public.update_exam_session(attempt,response,action,stage);
 select * into strict exam from public.tests where id=a.test_id;
 return public.exam_session_payload(a,exam);
end
$$;
revoke all on function public.exam_session_action(uuid,jsonb,text,integer) from public,anon;
grant execute on function public.exam_session_action(uuid,jsonb,text,integer) to authenticated;

create function public.settle_exam_sessions() returns void
language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; stamp timestamptz:=clock_timestamp();
begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
 for a in select * from public.test_attempts where user_id=auth.uid() and submitted_at is null and
   (fullscreen_deadline<=stamp or expires_at<=stamp) for update loop
   perform public.finalize_exam_session(a,case when a.fullscreen_deadline<=stamp then 'fullscreen' else 'time' end);
 end loop;
end
$$;
revoke all on function public.settle_exam_sessions() from public,anon;
grant execute on function public.settle_exam_sessions() to authenticated;

create or replace function public.attempt_review(attempt uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.test_attempts;begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
 select * into a from public.test_attempts where id=attempt and user_id=auth.uid() and submitted_at is not null;
 if not found then raise exception 'Completed attempt required'; end if;
 return jsonb_build_object('questions',(
   select jsonb_agg(x||jsonb_build_object('correct',public.exam_answer_correct(x,a.answers->(x->>'id'))) order by ord)
   from jsonb_array_elements(a.snapshot) with ordinality as items(x,ord)
 ),'answers',a.answers,'score',a.score,'total',a.total,
  'finish_reason',a.finish_reason,'sat_scores',a.sat_scores);
end
$$;
