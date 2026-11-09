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
 if exists(select 1 from jsonb_array_elements(q->'options') o where jsonb_typeof(o)<>'string' or length(trim(o#>>'{}'))=0) then raise exception 'Answer options must be nonempty text';end if;
 if (select count(distinct o) from jsonb_array_elements(q->'options') o)<>jsonb_array_length(q->'options') then raise exception 'Duplicate options are not allowed';end if;
 if q->>'type'='true_false_not_given' and q->'options'<>'["True","False","Not Given"]'::jsonb then raise exception 'Invalid True/False/Not Given options';end if;
 if q->>'type'='yes_no_not_given' and q->'options'<>'["Yes","No","Not Given"]'::jsonb then raise exception 'Invalid Yes/No/Not Given options';end if;

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
 if jsonb_typeof(accepted)<>'array' or trim(response#>>'{}') !~ '^[-+]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][-+]?[0-9]+)?$' then return false;end if;
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
revoke execute on function public.reserve_ai_request(uuid) from service_role;

