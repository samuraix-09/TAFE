
insert into public.tests(id,category_id,title,section,kind,duration,published,description,instructions,sat_session_form)
select 'fe816150-8c12-4b3a-b04a-000000000031',id,'Digital SAT · Adaptive Simulation','Reading and Writing + Math','mock',134,true,
 'OpenSAT question bank · TAFE adaptive simulation','Complete all four modules in order. Answer review unlocks after submission.',true
from public.exam_categories where slug='sat';

insert into public.sat_scoring_models(test_id,revision,name,reading_writing,math)
select 'fe816150-8c12-4b3a-b04a-000000000031',1,'TAFE OpenSAT Practice',reading_writing,math from public.sat_scoring_models
where test_id='fe816150-8c12-4b3a-b04a-000000000001' and revision=1;

create table public.opensat_routing (
 singleton boolean primary key default true check(singleton),
 reading_threshold integer not null default 70 check(reading_threshold between 0 and 100),
 math_threshold integer not null default 70 check(math_threshold between 0 and 100),
 minutes integer[] not null default array[32,32,35,35]
 check(array_lower(minutes,1)=1 and cardinality(minutes)=4 and array_position(minutes,null) is null
   and 1<=all(minutes) and 60>=all(minutes))
);
alter table public.opensat_routing enable row level security;
revoke all on public.opensat_routing from public,anon,authenticated;
insert into public.opensat_routing default values;

create function public.admin_opensat_settings(rw integer default null,m integer default null,timings integer[] default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare settings public.opensat_routing;
begin
 if not public.is_admin() or not public.account_active(auth.uid()) then raise exception 'Administrator required'; end if;
 if rw is not null or m is not null or timings is not null then
   update public.opensat_routing set reading_threshold=coalesce(rw,reading_threshold),
    math_threshold=coalesce(m,math_threshold),minutes=coalesce(timings,minutes) returning * into settings;
 else select * into settings from public.opensat_routing;
 end if;
 return to_jsonb(settings)-'singleton';
end
$$;
revoke all on function public.admin_opensat_settings(integer,integer,integer[]) from public,anon,authenticated;
grant execute on function public.admin_opensat_settings(integer,integer,integer[]) to authenticated;
create or replace function public.sat_section_sizes(t uuid) returns jsonb
language sql stable set search_path='' as $$
  select case when t='fe816150-8c12-4b3a-b04a-000000000031' then '{"reading_writing":54,"math":44}'::jsonb else jsonb_build_object(
    'reading_writing',count(*) filter(where m.section='reading_writing'),
    'math',count(*) filter(where m.section='math')) end
  from public.sat_exam_modules m
  join public.questions q on q.test_id=m.source_id and (m.source_id<>t or m.stage=q.position/4)
  join public.answer_keys k on k.question_id=q.id
  where m.test_id=t
$$;
revoke all on function public.sat_section_sizes(uuid) from public,anon,authenticated;

create or replace function public.exam_session_payload(a public.test_attempts, exam public.tests)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'id',a.id,'expires_at',a.expires_at,'module_expires_at',a.module_expires_at,
    'fullscreen_deadline',a.fullscreen_deadline,'paused_at',a.paused_at,'server_time',clock_timestamp(),
    'review_flags',coalesce(a.material->'review_flags','[]'::jsonb),'adaptive',coalesce(a.material->'adaptive','false'::jsonb),'route',a.material->'routes'->(a.exam_stage::text),'stage',a.exam_stage,'stage_count',a.material->'stage_count',
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

create or replace function public.open_exam_session(t uuid,web_session boolean) returns jsonb
language plpgsql set search_path='' as $$
declare a public.test_attempts; exam public.tests; snap jsonb; material jsonb; modules int; first_minutes int; model jsonb;
begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||t::text,0));
 select * into exam from public.tests where id=t and published;
 if not found then raise exception 'Test unavailable'; end if;
 if not public.can_access_test(auth.uid(),t) then raise exception 'Your plan does not include this test'; end if;
 if exam.sat_session_form and not web_session then raise exception 'Open this SAT test in the TAFE web app'; end if;
 select * into a from public.test_attempts where user_id=auth.uid() and test_id=t and submitted_at is null for update;
 if found then
   a:=public.refresh_exam_session(a,clock_timestamp());
   return public.exam_session_payload(a,exam);
 end if;
 if t='fe816150-8c12-4b3a-b04a-000000000031' then raise exception 'OPENSAT_BANK_REQUIRED'; end if;
 if web_session and exam.sat_module_source then raise exception 'This module is part of the full SAT practice test'; end if;

 select count(*),min(minutes) filter(where stage=0) into modules,first_minutes
 from public.sat_exam_modules where test_id=t;
 material:=jsonb_build_object('title',exam.title,'instructions',exam.instructions,'passage_title',exam.passage_title,
  'passage_text',exam.passage_text,'passage_image',exam.passage_image);
 if modules>0 then
   model:=public.sat_model_for_test(t);
   material:=material||jsonb_build_object('stage_count',modules,'estimate',model is not null,
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
 if model is not null then
   if jsonb_array_length(model->'reading_writing')<>1+(
       select count(*) from jsonb_array_elements(snap) q where q->>'sat_section'='reading_writing'
     ) or jsonb_array_length(model->'math')<>1+(
       select count(*) from jsonb_array_elements(snap) q where q->>'sat_section'='math'
     ) then
     raise exception 'The SAT form changed. Ask an administrator to update its scoring tables.';
   end if;
   material:=material||jsonb_build_object('sat_scoring',model);
 end if;
 perform public.consume_quota(auth.uid(),'test',exam.kind);
 insert into public.test_attempts(user_id,test_id,expires_at,total,snapshot,material,exam_stage,module_expires_at)
 values(auth.uid(),t,clock_timestamp()+make_interval(mins=>exam.duration),
  (select sum(coalesce((x->>'points')::int,1)) from jsonb_array_elements(snap) x),snap,material,
  case when modules>0 then 0 end,clock_timestamp()+make_interval(mins=>first_minutes)) returning * into a;
 return public.exam_session_payload(a,exam);
end
$$;


create function public.start_opensat_with_bank(learner uuid,bank jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t constant uuid:='fe816150-8c12-4b3a-b04a-000000000031'; a public.test_attempts; exam public.tests;
 snap jsonb; reserves jsonb; settings public.opensat_routing; stamp timestamptz; form jsonb;
begin
 perform set_config('request.jwt.claim.sub',learner::text,true);
 if not public.account_active(learner) then raise exception 'Account unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(learner::text||t::text,0));
 select * into strict exam from public.tests where id=t and published;
 if not public.can_access_test(learner,t) then raise exception 'Your plan does not include this test'; end if;
 select * into a from public.test_attempts where user_id=learner and test_id=t and submitted_at is null for update;
 if found then return public.exam_session_payload(public.refresh_exam_session(a,clock_timestamp()),exam); end if;
 if jsonb_typeof(bank) is distinct from 'array' or jsonb_array_length(bank)<>147
   or (select count(distinct q->>'id') from jsonb_array_elements(bank) q)<>147 then raise exception 'Incomplete OpenSAT bank'; end if;
 select * into strict settings from public.opensat_routing;
 with items as (
   select q||jsonb_build_object('accepted',q->'answer','stage',
     case when q->>'sat_section'='reading_writing' then 0 else 2 end+
     case when q->>'difficulty'='Medium' then 0 else 1 end) as item,ord
   from jsonb_array_elements(bank) with ordinality as it(q,ord)
 )
 select jsonb_agg(item order by (item->>'stage')::int,ord) filter(where item->>'difficulty'<>'Hard'),
   jsonb_agg(item order by ord) filter(where item->>'difficulty'='Hard')
 into snap,reserves from items;
 form:=jsonb_build_object('adaptive',true,'title',exam.title,'instructions',exam.instructions,
   'estimate',true,'stage_count',4,'stage_minutes',settings.minutes,'thresholds',array[settings.reading_threshold,settings.math_threshold],
   'reserves',reserves,'routes','{}'::jsonb,'sat_scoring',public.sat_model_for_test(t));
 perform public.consume_quota(learner,'test',exam.kind);
 stamp:=clock_timestamp();
 insert into public.test_attempts(user_id,test_id,started_at,expires_at,total,snapshot,material,exam_stage,module_expires_at)
 values(learner,t,stamp,stamp+make_interval(mins=>(select sum(n)::int from unnest(settings.minutes) n)),
   98,snap,form,0,stamp+make_interval(mins=>settings.minutes[1])) returning * into a;
 return public.exam_session_payload(a,exam);
end
$$;
revoke all on function public.start_opensat_with_bank(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.start_opensat_with_bank(uuid,jsonb) to service_role;
create or replace function public.update_exam_session(attempt uuid, response jsonb, action text, expected_stage integer)
returns public.test_attempts language plpgsql set search_path='' as $$
declare a public.test_attempts; stamp timestamptz; current_answers jsonb; last_stage int; next_minutes int; route text; pct numeric;
begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
 select * into a from public.test_attempts where id=attempt and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt unavailable'; end if;
 stamp:=clock_timestamp();
 a:=public.refresh_exam_session(a,stamp);
 if a.submitted_at is not null or a.exam_stage is distinct from expected_stage then return a; end if;
 if a.paused_at is not null then
   if action='resume' then
     update public.test_attempts set
       expires_at=a.expires_at+(stamp-a.paused_at),
       module_expires_at=a.module_expires_at+(stamp-a.paused_at),
       paused_duration=a.paused_duration+(stamp-a.paused_at),
       paused_at=null
     where id=a.id returning * into a;
   end if;
   return a;
 end if;
 if action='resume' then return a; end if;
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
   where (a.exam_stage is null or (x->>'stage')::int=a.exam_stage) and response ? (x->>'id') and (not coalesce((a.material->>'adaptive')::boolean,false)
     or jsonb_typeof(response->(x->>'id'))='null'
     or (x->'options') @> jsonb_build_array(response->(x->>'id')));
   a.answers:=a.answers||current_answers;
 end if;
 if action='finish' then
   if a.exam_stage is not null then raise exception 'Complete the SAT modules in order'; end if;
   return public.finalize_exam_session(a,'submitted');
 end if;
 if a.exam_stage is not null and action='advance' then
   last_stage:=(a.material->>'stage_count')::int-1;
   if a.exam_stage=last_stage then return public.finalize_exam_session(a,'submitted'); end if;
   if a.material->>'adaptive'='true' and a.exam_stage in (0,2) then
     select 100.0*count(*) filter(where public.exam_answer_correct(q,a.answers->(q->>'id')))/count(*)
     into pct from jsonb_array_elements(a.snapshot) q where (q->>'stage')::int=a.exam_stage;
     route:=case when pct >= (a.material->'thresholds'->>(a.exam_stage/2))::int then 'Hard' else 'Easy' end;
     if route='Hard' then
       select jsonb_agg(q order by (q->>'stage')::int,ord) into a.snapshot from
         jsonb_array_elements((select jsonb_agg(x) from jsonb_array_elements(a.snapshot) x where (x->>'stage')::int<>a.exam_stage+1)||(select jsonb_agg(x) from jsonb_array_elements(a.material->'reserves') x where (x->>'stage')::int=a.exam_stage+1)) with ordinality as items(q,ord)
       ;
     end if;
     a.material:=jsonb_set(a.material,array['routes',(a.exam_stage+1)::text],to_jsonb(route));
   end if;
   a.exam_stage:=a.exam_stage+1;
   next_minutes:=(a.material->'stage_minutes'->>a.exam_stage)::int;
   a.module_expires_at:=least(a.expires_at,stamp+make_interval(mins=>next_minutes));
 end if;
 if action='leave' then a.fullscreen_deadline:=stamp+interval '10 seconds'; end if;
 update public.test_attempts set answers=a.answers,exam_stage=a.exam_stage,snapshot=a.snapshot,material=a.material,
   module_expires_at=a.module_expires_at,fullscreen_deadline=a.fullscreen_deadline
 where id=a.id returning * into a;
 return a;
end
$$;



create function public.opensat_review_flags(attempt uuid, flags jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare a public.test_attempts;
begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
 if jsonb_typeof(flags) is distinct from 'array' or jsonb_array_length(flags)>98 then raise exception 'Invalid flags'; end if;
 select * into a from public.test_attempts where id=attempt and user_id=auth.uid()
  and submitted_at is null and material->>'adaptive'='true' for update;
 if not found then return; end if;
 update public.test_attempts set material=jsonb_set(a.material,'{review_flags}',(
   select coalesce(jsonb_agg(q->'id'),'[]'::jsonb) from jsonb_array_elements(a.snapshot) q
   where flags @> jsonb_build_array(q->'id') and (q->>'stage')::int<=a.exam_stage
 )) where id=a.id;
end
$$;
revoke all on function public.opensat_review_flags(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.opensat_review_flags(uuid,jsonb) to authenticated;
