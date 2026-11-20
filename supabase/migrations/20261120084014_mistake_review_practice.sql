create function public.practice_attempt_question(attempt uuid, question uuid, response jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare item jsonb;
begin
  if not public.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  if response is null or response='null'::jsonb or octet_length(response::text)>24000 then
    raise exception 'Invalid answer';
  end if;
  select q into item
  from public.test_attempts a cross join lateral jsonb_array_elements(a.snapshot) q
  where a.id=attempt and a.user_id=auth.uid() and a.submitted_at is not null
    and q->>'id'=question::text;
  if not found then raise exception 'Question unavailable'; end if;
  return jsonb_build_object('correct',public.exam_answer_correct(item,response));
end
$$;
revoke all on function public.practice_attempt_question(uuid,uuid,jsonb) from public,anon;
grant execute on function public.practice_attempt_question(uuid,uuid,jsonb) to authenticated;
