revoke delete on public.ai_conversations from authenticated;
create function public.delete_conversation(conversation uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.account_active(auth.uid()) then raise exception 'Account unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'ai-request',0));
 perform 1 from public.ai_conversations where id=conversation and user_id=auth.uid() for update;
 if not found then raise exception 'Conversation unavailable';end if;
 if exists(select 1 from public.ai_requests where conversation_id=conversation and status='pending' and created_at>now()-interval '90 seconds') then raise exception 'AI is still generating. Delete the conversation after it completes.';end if;
 update public.usage_events set error='Conversation deleted after interrupted request' where id in(select usage_id from public.ai_requests where conversation_id=conversation and status='pending');
 delete from public.ai_conversations where id=conversation and user_id=auth.uid();
end$$;
revoke all on function public.delete_conversation(uuid) from public,anon;
grant execute on function public.delete_conversation(uuid) to authenticated;

