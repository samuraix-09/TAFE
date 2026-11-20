alter table public.test_attempts add column paused_at timestamptz;
grant select(paused_at) on public.test_attempts to authenticated;

create function public.refresh_exam_session(a public.test_attempts, stamp timestamptz)
returns public.test_attempts language plpgsql set search_path='' as $$
begin
 if a.submitted_at is not null or a.paused_at is not null then return a; end if;
 if a.fullscreen_deadline<=stamp and a.fullscreen_deadline<a.expires_at then
   update public.test_attempts set paused_at=a.fullscreen_deadline,fullscreen_deadline=null
   where id=a.id returning * into a;
 elsif a.expires_at<=stamp then
   a:=public.finalize_exam_session(a,'time');
 end if;
 return a;
end
$$;
revoke all on function public.refresh_exam_session(public.test_attempts,timestamptz) from public,anon,authenticated;

create or replace function public.exam_session_payload(a public.test_attempts, exam public.tests)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'id',a.id,'expires_at',a.expires_at,'module_expires_at',a.module_expires_at,
    'fullscreen_deadline',a.fullscreen_deadline,'paused_at',a.paused_at,'server_time',clock_timestamp(),
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

create or replace function public.open_exam_session(t uuid,web_session boolean) returns jsonb
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
   a:=public.refresh_exam_session(a,clock_timestamp());
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

create or replace function public.exam_session_action(attempt uuid,response jsonb,action text,stage integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; exam public.tests;
begin
 if action is null or action not in ('save','finish','advance','leave','return','resume','status') then raise exception 'Invalid action'; end if;
 a:=public.update_exam_session(attempt,response,action,stage);
 select * into strict exam from public.tests where id=a.test_id;
 return public.exam_session_payload(a,exam);
end
$$;

create or replace function public.settle_exam_sessions() returns void
language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; stamp timestamptz:=clock_timestamp();
begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
 for a in select * from public.test_attempts where user_id=auth.uid() and submitted_at is null and paused_at is null and
   (fullscreen_deadline<=stamp or expires_at<=stamp) for update loop
   perform public.refresh_exam_session(a,stamp);
 end loop;
end
$$;
