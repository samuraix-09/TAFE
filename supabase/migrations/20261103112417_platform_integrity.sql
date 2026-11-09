alter table public.test_attempts add column material jsonb;
update public.plans set permissions=permissions||'{"full_mock":true}' where name in ('TAFE Focus','TAFE Mastery');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('tafe-test-images','tafe-test-images',false,3145728,array['image/jpeg','image/png','image/webp']);
create policy admin_test_images on storage.objects for all to authenticated using(bucket_id='tafe-test-images' and public.is_admin()) with check(bucket_id='tafe-test-images' and public.is_admin());
create function public.can_read_test_image(image_path text) returns boolean language sql stable security definer set search_path='' as $$
select public.account_active(auth.uid()) and exists(select 1 from public.tests t where t.passage_image=image_path and t.published and t.access_rank<=coalesce((public.entitlement(auth.uid())).library_rank,-1))
$$;
revoke all on function public.can_read_test_image(text) from public,anon;
grant execute on function public.can_read_test_image(text) to authenticated;
create policy read_test_images on storage.objects for select to authenticated using(bucket_id='tafe-test-images' and public.can_read_test_image(name));
create or replace function public.admin_save_test(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare tid uuid;q jsonb;r jsonb;v jsonb;idx integer:=0;expected integer;publish_flag boolean;accepted jsonb;begin
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
 passage_image=nullif(payload->>'passage_image',''),access_rank=coalesce((payload->>'access_rank')::int,0),kind=coalesce(payload->>'kind','practice'),version=version+1 where id=tid;
 delete from public.questions where test_id=tid;
 else
 insert into public.tests(id,title,category_id,duration,published,description,section,difficulty,instructions,passage_title,passage_text,passage_image,access_rank,kind)
 values(tid,trim(payload->>'title'),(payload->>'category_id')::uuid,(payload->>'duration')::int,publish_flag,coalesce(payload->>'description',''),coalesce(payload->>'section',''),coalesce(payload->>'difficulty','intermediate'),
 coalesce(payload->>'instructions',''),coalesce(payload->>'passage_title',''),coalesce(payload->>'passage_text',''),nullif(payload->>'passage_image',''),coalesce((payload->>'access_rank')::int,0),coalesce(payload->>'kind','practice'));
 end if;
 for q in select * from jsonb_array_elements(payload->'questions') loop
 if length(trim(q->>'prompt')) not between 1 and 10000 or q->>'type' not in ('multiple_choice','multiple_select','true_false_not_given','yes_no_not_given','matching_headings','matching_information','matching_features','matching_sentence_endings','sentence_completion','summary_completion','table_completion','short_answer','written_answer','numeric_answer','fill_blanks') or jsonb_typeof(q->'options')<>'array' then raise exception 'Invalid question configuration';end if;
 accepted:=q->'accepted';
 if publish_flag then
 if accepted is null or accepted = any(array['null','[]','{}','""']::jsonb[]) then raise exception 'Every published question needs an answer';end if;
 if q->>'type' in ('multiple_choice','multiple_select','true_false_not_given','yes_no_not_given') and jsonb_array_length(q->'options')<2 then raise exception 'Add answer options';end if;
 if q->>'type'='multiple_select' and jsonb_typeof(accepted)<>'array' then raise exception 'Select correct answers';end if;
if q->>'type' in ('multiple_choice','true_false_not_given','yes_no_not_given') and not (q->'options' @> jsonb_build_array(accepted)) then raise exception 'Correct answer must be one of the options';end if;
if q->>'type'='multiple_select' and not (q->'options' @> accepted) then raise exception 'Correct answers must be options';end if;
if jsonb_typeof(accepted)='array' and exists(select 1 from jsonb_array_elements_text(accepted) x where length(trim(x))=0) then raise exception 'Accepted answers cannot be blank';end if;
if q->>'type' like 'matching_%' or q->>'type' in ('summary_completion','table_completion','fill_blanks') then
if jsonb_typeof(q->'config'->'rows')<>'array' or jsonb_array_length(q->'config'->'rows')<1 then raise exception 'Add matching rows or answer slots';end if;
for r in select * from jsonb_array_elements(q->'config'->'rows') loop
v:=accepted->(r->>'id');
if length(trim(r->>'label'))=0 or v is null or v=any(array['null','""','[]']::jsonb[]) then raise exception 'Complete every matching row or slot';end if;
if q->>'type' like 'matching_%' and not(q->'options' @> jsonb_build_array(v)) then raise exception 'Matching answer must be an option';end if;
end loop;end if;
if q->>'type'='numeric_answer' and (jsonb_typeof(accepted)<>'array' or exists(select 1 from jsonb_array_elements_text(accepted) x where x !~ '^[-+]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][-+]?[0-9]+)?$')) then raise exception 'Numeric answer must be a finite number';end if;

 end if;
 insert into public.questions(id,test_id,prompt,options,position,type,config,points,required,group_name)
 values((q->>'id')::uuid,tid,trim(q->>'prompt'),q->'options',idx,q->>'type',jsonb_build_object('rows',coalesce(q->'config'->'rows','[]')),coalesce((q->>'points')::int,1),coalesce((q->>'required')::boolean,true),coalesce(q->>'group_name',''));
 insert into public.answer_keys(question_id,answer,accepted,explanation,evidence)
 values((q->>'id')::uuid,coalesce(q->>'answer',''),accepted,coalesce(q->>'explanation',''),coalesce(q->>'evidence',''));
 idx:=idx+1;
 end loop;
 return tid;
end$$;
create or replace function public.answer_matches(kind text,response jsonb,accepted jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;v jsonb;begin
 if response is null or response='null' or (jsonb_typeof(response)='string' and trim(response#>>'{}')='') then return false;end if;
 if kind='multiple_select' then
 if jsonb_typeof(response)<>'array' or jsonb_typeof(accepted)<>'array' then return false;end if;
 return response @> accepted and accepted @> response;
 elsif kind like 'matching_%' or kind in ('summary_completion','table_completion','fill_blanks') then
 if jsonb_typeof(response)<>'object' or jsonb_typeof(accepted)<>'object' then return false;end if;
 for k,v in select * from jsonb_each(accepted) loop
 if not public.answer_matches('short_answer',response->k,case when jsonb_typeof(v)='array' then v else jsonb_build_array(v) end) then return false;end if;
 end loop;return accepted<>'{}'::jsonb;
 elsif kind='numeric_answer' then
 if jsonb_typeof(accepted)<>'array' or (response#>>'{}') !~ '^[-+]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][-+]?[0-9]+)?$' then return false;end if;
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
 insert into public.test_attempts(user_id,test_id,expires_at,total,snapshot,material) values(auth.uid(),t,now()+make_interval(mins=>exam.duration),
 (select sum(coalesce((x->>'points')::int,1)) from jsonb_array_elements(snap) x),snap,jsonb_build_object('title',exam.title,'instructions',exam.instructions,'passage_title',exam.passage_title,'passage_text',exam.passage_text,'passage_image',exam.passage_image)) returning * into a;
 end if;
 return jsonb_build_object('id',a.id,'expires_at',a.expires_at,'answers',a.answers,'title',coalesce(a.material->>'title',exam.title),'instructions',coalesce(a.material->>'instructions',exam.instructions),'passage_title',coalesce(a.material->>'passage_title',exam.passage_title),'passage_text',coalesce(a.material->>'passage_text',exam.passage_text),'passage_image',coalesce(a.material->>'passage_image',exam.passage_image),
 'questions',(select jsonb_agg(x-array['answer','accepted','explanation','evidence']) from jsonb_array_elements(a.snapshot) x));
end$$;

