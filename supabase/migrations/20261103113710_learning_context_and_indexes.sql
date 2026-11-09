create index if not exists questions_test on public.questions(test_id,position);
create index if not exists tests_category on public.tests(category_id);
create index if not exists library_category on public.library_resources(category_id);
create index if not exists subscriptions_plan on public.subscriptions(plan_id);
create function public.learning_context(target uuid) returns jsonb language sql stable security definer set search_path='' as $$
with attempts as (select * from public.test_attempts where user_id=target and submitted_at is not null order by started_at desc limit 20),
answers as(select a.test_id,coalesce(q->>'type','multiple_choice') as question_type,
public.answer_matches(coalesce(q->>'type','multiple_choice'),a.answers->(q->>'id'),coalesce(q->'accepted',to_jsonb(q->>'answer'))) as correct
from attempts a cross join lateral jsonb_array_elements(a.snapshot) q),
types as(select question_type,count(*) as questions,count(*) filter(where not correct) as mistakes from answers group by question_type),
sections as(select coalesce(nullif(t.section,''),t.title) as section,count(*) as questions,count(*) filter(where not a.correct) as mistakes from answers a join public.tests t on t.id=a.test_id group by coalesce(nullif(t.section,''),t.title))
select jsonb_build_object('question_types',(select coalesce(jsonb_agg(types),'[]') from types),'sections',(select coalesce(jsonb_agg(sections),'[]') from sections))
$$;
revoke all on function public.learning_context(uuid) from public,anon,authenticated;
grant execute on function public.learning_context(uuid) to service_role;
create or replace function public.start_test(t uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts;exam public.tests;snap jsonb;p public.plans;begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||t::text,0));
 select * into exam from public.tests where id=t and published;
 if not found then raise exception 'Test unavailable';end if;
 if not public.can_access_test(auth.uid(),t) then raise exception 'Your plan does not include this test';end if;
 select * into a from public.test_attempts where user_id=auth.uid() and test_id=t and submitted_at is null;
 if not found then
 
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

