
alter table public.tests add column exam_archived boolean not null default false;
update public.tests set exam_archived=true where id not in ('fe816150-8c12-4b3a-b04a-000000000031','70767467-ea94-5677-9212-77a335806796');
insert into public.tests(id,category_id,title,section,duration,published)
select 'fe816150-8c12-4b3a-b04a-000000000041',id,'IELTS Academic · Full Practice','IELTS Academic',164,false from public.exam_categories where slug='ielts';

create table public.ielts_sections(
 stage integer primary key check(stage between 0 and 3),
 source_id uuid not null unique references public.tests(id),
 minutes integer not null check(minutes between 1 and 120),
 audio_path text
);
alter table public.ielts_sections enable row level security;
revoke all on public.ielts_sections from public,anon,authenticated;
insert into public.ielts_sections values(1,'70767467-ea94-5677-9212-77a335806796',60,null);

create or replace function public.web_exam_catalog() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'kind',t.kind,
 'description',t.description,'section',t.section,'duration',t.duration,'difficulty',t.difficulty,
 'exam_categories',jsonb_build_object('name',c.name)) order by t.title),'[]')
 from public.tests t join public.exam_categories c on c.id=t.category_id
 where t.id in ('fe816150-8c12-4b3a-b04a-000000000031','70767467-ea94-5677-9212-77a335806796','fe816150-8c12-4b3a-b04a-000000000041') and not t.exam_archived and public.can_access_test(auth.uid(),t.id)
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('tafe-ielts-audio','tafe-ielts-audio',false,52428800,array['audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm','audio/x-wav']),
('tafe-ielts-recordings','tafe-ielts-recordings',false,26214400,array['audio/mp4','audio/ogg','audio/webm']);
create function public.ielts_storage_allowed(path text, recording boolean, writing boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select public.account_active(auth.uid()) and (
 (not writing and public.is_admin()) or exists(select 1 from public.test_attempts a
 where a.user_id=auth.uid() and a.test_id='fe816150-8c12-4b3a-b04a-000000000041' and
 case when recording then split_part(path,'/',1)=auth.uid()::text and split_part(path,'/',2)=a.id::text
   and (not writing or (a.submitted_at is null and a.exam_stage=3))
 else not writing and a.submitted_at is null and a.exam_stage=0 and a.material->'sections'->0->>'audio_path'=path end))
$$;
revoke all on function public.ielts_storage_allowed(text,boolean,boolean) from public,anon;
grant execute on function public.ielts_storage_allowed(text,boolean,boolean) to authenticated;
create policy ielts_audio_read on storage.objects for select to authenticated
 using(bucket_id='tafe-ielts-audio' and public.ielts_storage_allowed(name,false,false));
create policy ielts_audio_upload on storage.objects for insert to authenticated
 with check(bucket_id='tafe-ielts-audio' and public.is_admin() and public.account_active(auth.uid()));
create policy ielts_recording_read on storage.objects for select to authenticated
 using(bucket_id='tafe-ielts-recordings' and public.ielts_storage_allowed(name,true,false));
create policy ielts_recording_upload on storage.objects for insert to authenticated
 with check(bucket_id='tafe-ielts-recordings' and public.ielts_storage_allowed(name,true,true));

create function public.admin_ielts_sections(sources uuid[] default null,timings int[] default null,audio text default null,activate boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare idx int; n int; expected int[]:=array[40,40,2,3];
begin
 if not public.is_admin() or not public.account_active(auth.uid()) then raise exception 'Administrator required'; end if;
 if sources is not null then
   perform 1 from public.tests where id='fe816150-8c12-4b3a-b04a-000000000041' for update;
   if cardinality(sources)<>4 or cardinality(timings) is distinct from 4 then raise exception 'Four sections required'; end if;
   if activate and not exists(select 1 from storage.objects where bucket_id='tafe-ielts-audio' and name=audio) then raise exception 'Upload Listening audio first'; end if;
   for idx in 1..4 loop
     if sources[idx] is null and not activate then continue; end if;
     if not exists(select 1 from public.tests t join public.exam_categories c on c.id=t.category_id
        where t.id=sources[idx] and c.slug='ielts' and t.id<>'fe816150-8c12-4b3a-b04a-000000000041') then raise exception 'Choose a valid IELTS source'; end if;
     select count(*) into n from public.questions q left join public.answer_keys k on k.question_id=q.id
     where q.test_id=sources[idx] and (idx>2 or k.question_id is not null);
     if activate and n<>expected[idx] then raise exception 'IELTS requires 40 Listening, 40 Reading, two Writing and three Speaking items'; end if;
     update public.tests set exam_archived=true where id=sources[idx];
   end loop;
   delete from public.ielts_sections;
   insert into public.ielts_sections select i-1,sources[i],timings[i],case when i=1 then audio end
   from generate_series(1,4) i where sources[i] is not null;
   update public.tests set exam_archived=activate where id='70767467-ea94-5677-9212-77a335806796';
   update public.tests set published=activate,duration=(select sum(u.minutes)::int from unnest(timings) u(minutes)) where id='fe816150-8c12-4b3a-b04a-000000000041';
 end if;
 return jsonb_build_object('sections',(select coalesce(jsonb_agg(to_jsonb(s) order by stage),'[]') from public.ielts_sections s),
 'published',(select published from public.tests where id='fe816150-8c12-4b3a-b04a-000000000041'));
end $$;
revoke all on function public.admin_ielts_sections(uuid[],int[],text,boolean) from public,anon;
grant execute on function public.admin_ielts_sections(uuid[],int[],text,boolean) to authenticated;

create table public.ielts_scoring_rules (
 id boolean primary key default true check(id),
 listening integer[] not null default array[1,2,3,4,6,8,10,13,16,18,23,26,30,32,35,37,39],
 reading integer[] not null default array[1,2,3,4,6,8,10,13,16,18,23,26,30,32,35,37,39]
);
alter table public.ielts_scoring_rules enable row level security;
revoke all on public.ielts_scoring_rules from public,anon,authenticated;
insert into public.ielts_scoring_rules default values;
create function public.admin_ielts_scoring(l integer[] default null,r integer[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rules integer[]; result jsonb;
begin
 if not public.is_admin() or not public.account_active(auth.uid()) then raise exception 'Administrator required'; end if;
 for rules in select v from (values(l),(r)) t(v) where v is not null loop
  if cardinality(rules)<>17 or array_lower(rules,1)<>1 or exists(
   select 1 from generate_subscripts(rules,1) idx
   where rules[idx] is null or rules[idx] not between 1 and 40 or rules[idx]<=rules[idx-1])
  then raise exception 'Provide 17 increasing thresholds between 1 and 40'; end if;
 end loop;
 if l is not null or r is not null then update public.ielts_scoring_rules set listening=coalesce(l,listening),reading=coalesce(r,reading); end if;
 select to_jsonb(t)-'id' into result from public.ielts_scoring_rules t;
 return result;
end $$;
revoke all on function public.admin_ielts_scoring(integer[],integer[]) from public,anon;
grant execute on function public.admin_ielts_scoring(integer[],integer[]) to authenticated;
create function public.open_ielts_form(exam public.tests) returns jsonb
language plpgsql set search_path='' as $$
declare a public.test_attempts; snap jsonb; content jsonb; timings jsonb; stamp timestamptz:=clock_timestamp();
begin
 select jsonb_agg(jsonb_build_object('passage_text',t.passage_text,'passage_title',t.passage_title,'audio_path',s.audio_path) order by s.stage),
 jsonb_agg(s.minutes order by s.stage) into content,timings
 from public.ielts_sections s join public.tests t on t.id=s.source_id;
 if jsonb_array_length(timings) is distinct from 4 or content->0->>'audio_path' is null then raise exception 'IELTS content incomplete'; end if;
 select jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'options',q.options,
 'type',case s.stage when 2 then 'written_answer' when 3 then 'speaking_prompt' else q.type end,
 'config',q.config,'group_name',q.group_name,'stage',s.stage,'required',s.stage<2,
 'points',case when s.stage<2 then 1 else 0 end,'answer',k.answer,
 'accepted',coalesce(k.accepted,to_jsonb(k.answer)),'explanation',k.explanation) order by s.stage,q.position,q.id)
 into snap from public.ielts_sections s join public.questions q on q.test_id=s.source_id
 left join public.answer_keys k on k.question_id=q.id and s.stage<2 where s.stage>=2 or k.question_id is not null;
 if (select array_agg(n order by stage) from (select q->>'stage' stage,count(*)::int n from jsonb_array_elements(snap) q group by 1) x)
 is distinct from array[40,40,2,3] then raise exception 'IELTS content changed. Republish the form.'; end if;
 perform public.consume_quota(auth.uid(),'test',exam.kind);
 insert into public.test_attempts(user_id,test_id,started_at,expires_at,total,snapshot,material,exam_stage,module_expires_at)
 values(auth.uid(),exam.id,stamp,stamp+make_interval(mins=>exam.duration),80,snap,
 jsonb_build_object('ielts',true,'title',exam.title,'sections',content,'scoring',(select to_jsonb(t)-'id' from public.ielts_scoring_rules t),'stage_count',4,'stage_minutes',timings),0,
 stamp+make_interval(mins=>(timings->>0)::int)) returning * into a;
 return public.exam_session_payload(a,exam);
end $$;
revoke all on function public.open_ielts_form(public.tests) from public,anon,authenticated;
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
    'ielts',a.material->'ielts','audio_path',a.material->'sections'->a.exam_stage->'audio_path','title',coalesce(a.material->>'title',exam.title),
    'instructions',coalesce(a.material->>'instructions',exam.instructions),
    'passage_title',coalesce(a.material->'sections'->a.exam_stage->>'passage_title',a.material->>'passage_title',exam.passage_title),
    'passage_text',coalesce(a.material->'sections'->a.exam_stage->>'passage_text',a.material->>'passage_text',exam.passage_text),
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
 if exam.exam_archived then raise exception 'Test unavailable'; end if;
 if t='fe816150-8c12-4b3a-b04a-000000000041' then
   if not web_session then raise exception 'Open IELTS on the web'; end if;
   return public.open_ielts_form(exam);
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
   where (a.exam_stage is null or (x->>'stage')::int=a.exam_stage) and response ? (x->>'id')
  and (a.material->>'ielts' is distinct from 'true' or x->>'stage'<>'2'
    or (jsonb_typeof(response->(x->>'id'))='string' and length(response->>(x->>'id'))<=10000))
  and (a.material->>'ielts' is distinct from 'true' or x->>'stage'<>'3'
    or exists(select 1 from storage.objects o where o.bucket_id='tafe-ielts-recordings' and o.name=response->>(x->>'id')
      and split_part(o.name,'/',1)=a.user_id::text and split_part(o.name,'/',2)=a.id::text
      and split_part(o.name,'/',3) like (x->>'id')||'-%'))
  and (not coalesce((a.material->>'adaptive')::boolean,false)
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



create table public.ielts_assessments (
 attempt_id uuid primary key references public.test_attempts(id) on delete cascade,
 writing numeric check(writing between 0 and 9 and mod(writing*2,1)=0),
 speaking numeric check(speaking between 0 and 9 and mod(speaking*2,1)=0),
 feedback text not null default ''
);
alter table public.ielts_assessments enable row level security;
revoke all on public.ielts_assessments from public,anon,authenticated;
create function public.ielts_report(attempt uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.test_attempts; g public.ielts_assessments; l int; r int; lb numeric; rb numeric;
begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
 select * into a from public.test_attempts where id=attempt and submitted_at is not null
 and test_id='fe816150-8c12-4b3a-b04a-000000000041' and (user_id=auth.uid() or public.is_admin());
 if not found then raise exception 'IELTS result unavailable'; end if;
 select count(*) filter(where q->>'stage'='0'),count(*) filter(where q->>'stage'='1') into l,r
 from jsonb_array_elements(a.snapshot) q where q->>'stage' in ('0','1') and public.exam_answer_correct(q,a.answers->(q->>'id'));
 select coalesce(max((i+1)*0.5),0) into lb from jsonb_array_elements_text(a.material->'scoring'->'listening') with ordinality x(n,i) where l>=n::int;
 select coalesce(max((i+1)*0.5),0) into rb from jsonb_array_elements_text(a.material->'scoring'->'reading') with ordinality x(n,i) where r>=n::int;
 select * into g from public.ielts_assessments where attempt_id=a.id;
 return jsonb_build_object('listening',lb,'reading',rb,'listening_correct',l,'reading_correct',r,
 'writing',g.writing,'speaking',g.speaking,'feedback',g.feedback,'overall',round((lb+rb+g.writing+g.speaking)/2)/2,
 'review',(select jsonb_agg(jsonb_build_object('stage',q->'stage','prompt',q->'prompt','response',a.answers->(q->>'id')) order by ord)
 from jsonb_array_elements(a.snapshot) with ordinality as items(q,ord) where q->>'stage' in ('2','3')));
end $$;
revoke all on function public.ielts_report(uuid) from public,anon;
grant execute on function public.ielts_report(uuid) to authenticated;
create function public.admin_ielts_attempts() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() or not public.account_active(auth.uid()) then raise exception 'Administrator required'; end if;
 return (select coalesce(jsonb_agg(z order by submitted_at desc),'[]') from
 (select id,user_id,submitted_at from public.test_attempts where test_id='fe816150-8c12-4b3a-b04a-000000000041' and submitted_at is not null
 order by submitted_at desc limit 100) z);
end $$;
revoke all on function public.admin_ielts_attempts() from public,anon;
grant execute on function public.admin_ielts_attempts() to authenticated;
create function public.admin_grade_ielts(attempt uuid,w numeric,s numeric,notes text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() or not public.account_active(auth.uid()) then raise exception 'Administrator required'; end if;
 if length(notes)>5000 then raise exception 'Feedback too long'; end if;
 perform public.ielts_report(attempt);
 insert into public.ielts_assessments values(attempt,w,s,coalesce(notes,''))
 on conflict(attempt_id) do update set writing=excluded.writing,speaking=excluded.speaking,feedback=excluded.feedback;
end $$;
revoke all on function public.admin_grade_ielts(uuid,numeric,numeric,text) from public,anon;
grant execute on function public.admin_grade_ielts(uuid,numeric,numeric,text) to authenticated;

create table public.exam_highlights (
 attempt_id uuid not null references public.test_attempts(id) on delete cascade,
 scope text not null check(length(scope) between 1 and 100),
 marks jsonb not null check(jsonb_typeof(marks)='array' and octet_length(marks::text)<=16000),
 primary key(attempt_id,scope)
);
alter table public.exam_highlights enable row level security;
revoke all on public.exam_highlights from public,anon,authenticated;
create function public.exam_passage_marks(attempt uuid, scope_key text, saved_marks jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts;
begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
 select * into a from public.test_attempts where id=attempt and user_id=auth.uid();
 if not found then raise exception 'Attempt unavailable'; end if;
 if saved_marks is not null then
  if a.submitted_at is not null then return null; end if;
  insert into public.exam_highlights values(attempt,scope_key,saved_marks)
    on conflict(attempt_id,scope) do update set marks=excluded.marks;
  return saved_marks;
 end if;
 return (select h.marks from public.exam_highlights h where h.attempt_id=attempt and scope=scope_key);
end $$;
revoke all on function public.exam_passage_marks(uuid,text,jsonb) from public,anon;
grant execute on function public.exam_passage_marks(uuid,text,jsonb) to authenticated;
