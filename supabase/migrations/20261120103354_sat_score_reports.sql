-- Fixed-form TAFE practice conversions. These tables do not implement College Board scoring.
create table public.sat_scoring_models (
  test_id uuid not null references public.tests(id) on delete cascade,
  revision integer not null check (revision > 0),
  name text not null check (length(name) between 1 and 100),
  reading_writing integer[] not null,
  math integer[] not null,
  primary key (test_id, revision)
);
alter table public.sat_scoring_models enable row level security;
revoke all on public.sat_scoring_models from public, anon, authenticated;

alter table public.test_attempts add column paused_duration interval not null default interval '0';
alter table public.test_attempts add column sat_question_results jsonb;

create function public.sat_model_for_test(t uuid) returns jsonb
language sql stable set search_path='' as $$
  select to_jsonb(m)-'test_id' from public.sat_scoring_models m
  where m.test_id=t order by m.revision desc limit 1
$$;
revoke all on function public.sat_model_for_test(uuid) from public,anon,authenticated;

create function public.sat_section_sizes(t uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'reading_writing',count(*) filter(where m.section='reading_writing'),
    'math',count(*) filter(where m.section='math'))
  from public.sat_exam_modules m
  join public.questions q on q.test_id=m.source_id and (m.source_id<>t or m.stage=q.position/4)
  join public.answer_keys k on k.question_id=q.id
  where m.test_id=t
$$;
revoke all on function public.sat_section_sizes(uuid) from public,anon,authenticated;

create function public.admin_sat_scoring(t uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() or not public.account_active(auth.uid()) then raise exception 'Administrator required'; end if;
  if not exists(select 1 from public.tests where id=t and sat_session_form) then raise exception 'SAT form required'; end if;
  return jsonb_build_object('counts',public.sat_section_sizes(t),'model',public.sat_model_for_test(t));
end
$$;
revoke all on function public.admin_sat_scoring(uuid) from public,anon,authenticated;
grant execute on function public.admin_sat_scoring(uuid) to authenticated;

create function public.valid_sat_curve(curve integer[], items integer) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(items>0 and array_ndims(curve)=1 and array_lower(curve,1)=1
    and cardinality(curve)=items+1 and curve[1]=200 and curve[items+1]=800 and not exists(
      select 1 from generate_subscripts(curve,1) i
      where curve[i] is null or curve[i] not between 200 and 800 or curve[i]%10<>0 or curve[i]<curve[i-1]
    ),false)
$$;
revoke all on function public.valid_sat_curve(integer[],integer) from public,anon,authenticated;

create function public.admin_save_sat_scoring(
  t uuid, expected_revision integer, model_name text, reading_curve integer[], math_curve integer[]
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare counts jsonb; latest int;
begin
  if not public.is_admin() or not public.account_active(auth.uid()) then raise exception 'Administrator required'; end if;
  perform 1 from public.tests where id=t and sat_session_form for update;
  if not found then raise exception 'SAT form required'; end if;
  latest:=coalesce((public.sat_model_for_test(t)->>'revision')::int,0);
  if latest is distinct from expected_revision then raise exception 'Scoring revision changed. Reload the form.'; end if;
  if model_name is null or length(trim(model_name)) not between 1 and 100 then raise exception 'Model name must contain 1 to 100 characters'; end if;
  counts:=public.sat_section_sizes(t);
  if not public.valid_sat_curve(reading_curve,(counts->>'reading_writing')::int)
    or not public.valid_sat_curve(math_curve,(counts->>'math')::int) then
    raise exception 'Each scoring table must cover every correct-answer count with nondecreasing scores from 200 to 800 in steps of 10';
  end if;
  insert into public.sat_scoring_models(test_id,revision,name,reading_writing,math)
  values(t,latest+1,trim(model_name),reading_curve,math_curve);
  return public.admin_sat_scoring(t);
end
$$;
revoke all on function public.admin_save_sat_scoring(uuid,integer,text,integer[],integer[]) from public,anon,authenticated;
grant execute on function public.admin_save_sat_scoring(uuid,integer,text,integer[],integer[]) to authenticated;

-- Each array starts at zero correct answers. See docs/sat-scoring.md for the practice model.
insert into public.sat_scoring_models(test_id,revision,name,reading_writing,math)
values('fe816150-8c12-4b3a-b04a-000000000001',1,'TAFE Full Practice',
  array[200,210,220,230,240,250,260,270,290,300,310,320,330,340,350,360,370,380,390,400,410,420,430,440,450,460,470,480,490,500,510,520,530,540,550,560,570,590,600,610,630,640,650,670,680,690,700,720,730,740,750,770,780,790,800],
  array[200,210,230,240,250,270,280,290,310,320,330,350,360,370,380,390,400,420,430,440,450,460,470,480,500,510,520,530,550,560,570,590,600,620,630,650,660,680,700,710,730,750,760,780,800]);

-- Pre-existing unfinished full forms have the same layout. Preserve the old attempt and pin the new conversion.
update public.test_attempts a set material=a.material||jsonb_build_object('sat_scoring',public.sat_model_for_test(a.test_id))
where a.test_id='fe816150-8c12-4b3a-b04a-000000000001' and a.submitted_at is null
  and (select count(*) from jsonb_array_elements(a.snapshot) q where q->>'sat_section'='reading_writing')=54
  and (select count(*) from jsonb_array_elements(a.snapshot) q where q->>'sat_section'='math')=44;

create function public.exam_response_present(response jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
  case jsonb_typeof(response)
    when 'null' then return false;
    when 'string' then return (response#>>'{}') !~ '^[[:space:]]*$';
    when 'array' then return exists(select 1 from jsonb_array_elements(response) v where public.exam_response_present(v));
    when 'object' then return exists(select 1 from jsonb_each(response) e where public.exam_response_present(e.value));
    else return response is not null;
  end case;
end
$$;
revoke all on function public.exam_response_present(jsonb) from public,anon,authenticated;

create function public.sat_review_counts(statuses jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object(
    'questions',count(*),'correct',count(*) filter(where x='correct'),
    'incorrect',count(*) filter(where x='wrong'),'unanswered',count(*) filter(where x='missing'),
    'accuracy',coalesce(round(100.0*count(*) filter(where x='correct')/nullif(count(*),0),1),0))
  from jsonb_array_elements_text(statuses) x
$$;
revoke all on function public.sat_review_counts(jsonb) from public,anon,authenticated;

create or replace function public.finalize_exam_session(a public.test_attempts, reason text)
returns public.test_attempts language plpgsql set search_path='' as $$
declare earned int; details jsonb; stats jsonb; sections jsonb; breakdown jsonb;
  model jsonb:=a.material->'sat_scoring';
  stamp timestamptz:=clock_timestamp();
begin
  if a.submitted_at is not null then return a; end if;
  with graded as (
    select x->>'id' id, coalesce((x->>'points')::int,1) points, x->>'sat_section' section,
      coalesce(nullif(trim(x->'config'->>'sat_topic'),''),nullif(trim(x->>'group_name'),'')) topic,
      nullif(trim(x->>'group_name'),'') skill,
      case when public.exam_answer_correct(x,a.answers->(x->>'id')) then 'correct'
        when public.exam_response_present(a.answers->(x->>'id')) then 'wrong'
        else 'missing' end as status
    from jsonb_array_elements(a.snapshot) x
  ), by_section as (
    select section,public.sat_review_counts(jsonb_agg(status)) counts
    from graded where section is not null group by section
  ), by_skill as (
    select section,topic,skill,public.sat_review_counts(jsonb_agg(status)) counts
    from graded where section is not null group by section,topic,skill
  )
  select coalesce(sum(points) filter(where status='correct'),0),
    jsonb_object_agg(id,status),public.sat_review_counts(jsonb_agg(status)),
    (select jsonb_object_agg(section,counts||jsonb_build_object(
      'scaled',model->section->((counts->>'correct')::int))) from by_section),
    (select jsonb_agg(jsonb_build_object('section',section,'topic',topic,'skill',skill)||counts
      order by section desc,topic,skill) from by_skill)
  into earned,details,stats,sections,breakdown
  from graded;

  if sections is not null then
    stats:=stats||sections||jsonb_build_object(
      'duration_seconds',greatest(0,floor(extract(epoch from (
        (case when reason='time' then least(stamp,a.expires_at) else stamp end)-a.started_at-a.paused_duration))))::int,
      'breakdown',breakdown);
    if model is not null then
      stats:=stats||jsonb_build_object('method','tafe_practice_table','model_name',model->>'name',
        'model_revision',model->'revision',
        'total',(sections->'math'->>'scaled')::int+(sections->'reading_writing'->>'scaled')::int);
    end if;
  else
    stats:=null;
    details:=null;
  end if;
  update public.test_attempts set answers=a.answers,submitted_at=stamp,score=earned,
    sat_scores=stats,sat_question_results=details,finish_reason=reason,fullscreen_deadline=null
  where id=a.id returning * into a;
  return a;
end
$$;

create or replace function public.attempt_review(attempt uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.test_attempts;begin
  if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  select * into a from public.test_attempts where id=attempt and user_id=auth.uid() and submitted_at is not null;
  if not found then raise exception 'Completed attempt required'; end if;
  return jsonb_build_object('questions',(
    select jsonb_agg(x||jsonb_build_object(
      'correct',coalesce((a.sat_question_results->>(x->>'id'))='correct',
        public.exam_answer_correct(x,a.answers->(x->>'id'))),
      'status',a.sat_question_results->(x->>'id')) order by ord)
    from jsonb_array_elements(a.snapshot) with ordinality as items(x,ord)
  ),'answers',a.answers,'score',a.score,'total',a.total,'title',a.material->>'title',
    'started_at',a.started_at,'submitted_at',a.submitted_at,
    'finish_reason',a.finish_reason,'sat_scores',a.sat_scores);
end
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

create or replace function public.update_exam_session(attempt uuid, response jsonb, action text, expected_stage integer)
returns public.test_attempts language plpgsql set search_path='' as $$
declare a public.test_attempts; stamp timestamptz; current_answers jsonb; last_stage int; next_minutes int;
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


-- Tag the original full-form questions by prompt fingerprint. Preserve edited questions and existing tags.
with tags(test_id,prompt_hash,topic,skill) as (values
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'064955a615064a5c9be4ad0f81fd4689','Craft and Structure','Words in Context'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'b1acd8e1f21595afc86a3f77e7efda71','Craft and Structure','Words in Context'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'5ed43b9dbf82d834847f48cbddbaff0a','Craft and Structure','Words in Context'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'f213baa54400ca841cb43993f62bd4a8','Craft and Structure','Words in Context'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'9e57dec4291e8ba6f4e2e8bdceb89473','Craft and Structure','Words in Context'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'ab34d470743797be3b9942eb91fc9283','Craft and Structure','Words in Context'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'0416e1cfdb70fda759307f9c7fcc8dbd','Craft and Structure','Words in Context'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'f5226c5acb79378150239adf130b4d37','Craft and Structure','Words in Context'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'1255d820c5fdd41efbf8d7d24c98ec44','Craft and Structure','Words in Context'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'a9afd29302e302840cad5a80f1c8e9c3','Standard English Conventions','Form, Structure, and Sense'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'1539e429dbeff5677ec76625fdb6e1bb','Standard English Conventions','Form, Structure, and Sense'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'04e46a31e385d2ff74161ccf7d1df7dd','Standard English Conventions','Form, Structure, and Sense'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'77ecf25bbe0a9e0bb743822e7b10245a','Standard English Conventions','Form, Structure, and Sense'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'c32fcb1e1f06a60d843469cc8337857e','Standard English Conventions','Form, Structure, and Sense'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'5bbf3c099ad5e7c49067edc25876e0b9','Standard English Conventions','Form, Structure, and Sense'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'0af7354914295d26226018719abca7c2','Standard English Conventions','Form, Structure, and Sense'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'a6df1124b2319b8f31f8913caf0ce93b','Standard English Conventions','Form, Structure, and Sense'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'1c32a1206abbefe1af5f085f5721a3df','Standard English Conventions','Form, Structure, and Sense'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'ff05edc2b157d368127bfaedbd9845ab','Information and Ideas','Main Ideas and Details'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'88ccbf34fe937d0536ca16f1f0003351','Information and Ideas','Inference'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'234ea03c850b40ab1c08aefa9b2fab0c','Information and Ideas','Main Ideas and Details'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'2a7195a6c70cdd3dffdcd1e32916e7a9','Information and Ideas','Main Ideas and Details'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'0b1ad984661606b9466589a03bb90e42','Information and Ideas','Main Ideas and Details'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'7b0d0fd915ad72259c95e9026516f47f','Information and Ideas','Inference'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'698df519eca77e9b2f997cdad1743dde','Craft and Structure','Text Structure and Purpose'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'de2695088194c6ac99d484c64dd1c97e','Information and Ideas','Main Ideas and Details'),
 ('e4b994df-8f8f-582a-bba2-e53c002d825a'::uuid,'e20c13c2db81dc7dde41e574c34f36b9','Information and Ideas','Textual Evidence'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'754e63337164e54012c3c5a587b15364','Craft and Structure','Words in Context'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'312ae33423cc4d9a2bcb5815cf5432ab','Craft and Structure','Words in Context'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'ff53a9ac37b08d8af0c8e66a01170511','Craft and Structure','Words in Context'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'90471c08cc50ec6f344b740873d9f41a','Craft and Structure','Words in Context'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'56988a48cf3c2330d6b24bc35392c21e','Craft and Structure','Words in Context'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'8f6e5212a84e63e6ae545a2fb93e4362','Craft and Structure','Words in Context'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'c5ce5267d1155fab835e229cbdeb6e83','Craft and Structure','Words in Context'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'c82b33920a8f36c0e3f94606a01edb21','Craft and Structure','Words in Context'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'967df23bedee5fc5a96ff7643170b9ed','Craft and Structure','Words in Context'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'a48abcd3f00ebed8bb2859dba6170caf','Standard English Conventions','Form, Structure, and Sense'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'46eb3932f98d6843a31b8092e1423a04','Standard English Conventions','Form, Structure, and Sense'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'02197d98f43b7b5db77f98be1540d188','Standard English Conventions','Form, Structure, and Sense'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'ebfc34edc579d9cf15f518cb88fffcb4','Expression of Ideas','Transitions'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'c7887cacae654d4c6cb6b21dc9cb6f09','Expression of Ideas','Transitions'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'ce3302a896991e35b9b0435af669a20a','Expression of Ideas','Transitions'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'ba0fccd993c86826b49be65041c8ccf5','Expression of Ideas','Transitions'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'7d6b46e990211755085f1fc598ffffcb','Expression of Ideas','Transitions'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'05a9a65a5ccce3d4d25c5f54a0d46344','Expression of Ideas','Transitions'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'6b7c798079498fc978bb177c6fa452e7','Information and Ideas','Main Ideas and Details'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'d9e0c5be5b12df9a7d140cc54f8de4e2','Information and Ideas','Inference'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'3a3a774725e83801c4cfffd1ea71a671','Information and Ideas','Main Ideas and Details'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'1fa384ed7223f67cf78ace33e3a6a65c','Information and Ideas','Main Ideas and Details'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'14f113c77ad40ca5454dd3795bf897c7','Information and Ideas','Inference'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'e9c07cb26bec9d7eae81126c8d74fdb9','Information and Ideas','Main Ideas and Details'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'2f2e3dde80c3afa8df69a63fd263eabe','Information and Ideas','Main Ideas and Details'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'5b6886f44fa48158b6aad9c6e7ea2d64','Information and Ideas','Inference'),
 ('9c4d7708-f642-5cca-9458-57c66aa2f1b7'::uuid,'e951cc2f6d8375e828f7b07918755b82','Information and Ideas','Inference'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'0f1707e000433045b72fe758734a4a37','Algebra','Linear equations'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'7c641e8e9fa04aec23001166c0a034e5','Problem-Solving and Data Analysis','Percentages'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'f348b0b7e70700becab171b90aa6e8c7','Advanced Math','Quadratic equations'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'8f56c4eaffd57d583ed2945d09a3a89e','Algebra','Slope'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'69ae4ce559f479979418cdc2666b0e31','Geometry and Trigonometry','Area'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'aaf19c121a427151519db69c824e8205','Problem-Solving and Data Analysis','Mean'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'d6283fc2e1d4ec9b7279f6ba618d5e25','Problem-Solving and Data Analysis','Probability'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'47e0924c6605c09bbf77f3557f90ef2b','Advanced Math','Quadratic functions'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'f571a46166091c55d5cb314e7e8c4811','Advanced Math','Exponential growth'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'8ca45c2e40020bf03aafc19674167245','Geometry and Trigonometry','Right triangles'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'38139595d7915974176e34b2d68451cd','Algebra','Systems of equations'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'bbdda68fc55bc42a9faa07f6fa1e6943','Algebra','Linear equations'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'8e35c8561106ae57d5e962e6b1500266','Problem-Solving and Data Analysis','Percentages'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'b19378987fd45430d433cc038af52f18','Advanced Math','Quadratic equations'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'01b9ddabdca5a53961ce47f2a12cefb2','Algebra','Slope'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'cea3b84b0db30bb830fce8ee8edf3a5a','Geometry and Trigonometry','Area'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'08772eb8235d1897eecfb51b49942870','Problem-Solving and Data Analysis','Mean'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'05643f982af89be7a3bafb3adaa46daa','Problem-Solving and Data Analysis','Probability'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'0fa86e156fad7c8512421db5d4b6dd90','Advanced Math','Quadratic functions'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'96e72fc473ec35ecf22d27fe92774937','Advanced Math','Exponential growth'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'ea53fedce3d5ba3df908521cfda27d01','Geometry and Trigonometry','Right triangles'),
 ('e74e5cb0-f8b8-5c37-bf33-7026c247b906'::uuid,'efee2a1b011adf0149786d4033bebc83','Algebra','Systems of equations'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'c15edbcf8d0008c8773ea5bccc535eb0','Algebra','Linear equations'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'8a508a66e990b9399b961b14f6a30c7f','Problem-Solving and Data Analysis','Percentages'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'fd8161e175f6ae102bc26e72e9532780','Advanced Math','Quadratic equations'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'4fb0138b05493f49831ea89528adf69b','Algebra','Slope'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'34221a067e8f2f6e68c7ea0570fcbee9','Geometry and Trigonometry','Area'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'47f40e5805fc3989d28bb9c8ac89c38d','Problem-Solving and Data Analysis','Mean'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'56b31094b1bb4697797ae88229d505b4','Problem-Solving and Data Analysis','Probability'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'fad8435eb56bf4f638ef4e45ac0a55e3','Advanced Math','Quadratic functions'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'a33253d7f4c980c88bcd306de61202f6','Advanced Math','Exponential growth'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'9ca46d74f5816a505a9a7d001827cbc7','Geometry and Trigonometry','Right triangles'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'2c46ceeea8f19c81159cc9f64d51abcd','Algebra','Systems of equations'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'d18edfc9675583e051310300bd523221','Algebra','Linear equations'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'6c615f095b6bda2c4caa21fc8a9ec9cd','Problem-Solving and Data Analysis','Percentages'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'8dc2cbc1d7fa961435d91181614afc46','Advanced Math','Quadratic equations'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'813368830b8c5c17fbd0c093e522cde2','Algebra','Slope'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'a0a74c5a9a1fd93b8a519048ab04d7a9','Geometry and Trigonometry','Area'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'98d0cc85dbc2125fb4cc4b6c0e19b1c1','Problem-Solving and Data Analysis','Mean'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'83fda8033d8615ecd3930bba2acc3bb4','Problem-Solving and Data Analysis','Probability'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'b22ae64d659477f137cc684731519213','Advanced Math','Quadratic functions'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'54fcbdd14312f0755de5c9efc96c8f44','Advanced Math','Exponential growth'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'1089c0cfa319ae6cf638fbee7b4d1190','Geometry and Trigonometry','Right triangles'),
 ('2b07157d-ac83-5713-9ee9-ea7e0329dc2d'::uuid,'4b52f35269b418ed5f4619f98dad1c10','Algebra','Systems of equations')
)
update public.questions q set group_name=tags.skill,
  config=coalesce(q.config,'{}'::jsonb)||jsonb_build_object('sat_topic',tags.topic)
from tags where tags.test_id=q.test_id and tags.prompt_hash=md5(q.prompt)
  and trim(q.group_name)='' and not (q.config ? 'sat_topic');
