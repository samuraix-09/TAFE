create table public.ai_requests(
 id uuid primary key,user_id uuid not null references auth.users on delete cascade,
 conversation_id uuid not null references public.ai_conversations on delete cascade,
 usage_id uuid not null references public.usage_events, status text not null default 'pending' check(status in ('pending','completed','failed')),
 response_id uuid references public.ai_messages on delete set null,created_at timestamptz not null default now()
);
create index ai_requests_owner on public.ai_requests(user_id,created_at);
alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from anon,authenticated;
grant all on public.ai_requests to service_role;
create function public.begin_ai_request(target uuid,conversation uuid,request_id uuid,feature_mode text,prompt text) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.ai_requests;usage uuid;begin
 if length(prompt) not between 1 and 4000 then raise exception 'Invalid prompt';end if;
 if feature_mode not in ('ask','explain','practice','plan','analysis') then raise exception 'Invalid AI feature';end if;
 if not exists(select 1 from public.ai_conversations where id=conversation and user_id=target) then raise exception 'Conversation unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text||'ai-request',0));
 select * into job from public.ai_requests where id=request_id;
 if found then
 if job.user_id<>target then raise exception 'Request unavailable';end if;
 return jsonb_build_object('status',job.status,'answer',(select content from public.ai_messages where id=job.response_id));
 end if;
 if exists(select 1 from public.ai_requests where user_id=target and status='pending' and created_at>now()-interval '90 seconds') then raise exception 'An AI request is already running';end if;
 update public.ai_requests set status='failed' where user_id=target and status='pending' and created_at<=now()-interval '90 seconds';
 usage:=public.consume_quota(target,'ai',feature_mode);
 insert into public.ai_requests(id,user_id,conversation_id,usage_id) values(request_id,target,conversation,usage);
 insert into public.ai_messages(conversation_id,role,content) values(conversation,'user',prompt);
 return jsonb_build_object('status','started','usageId',usage);
end$$;
create function public.finish_ai_request(request_id uuid,answer text,token_count integer,error_message text default null) returns void language plpgsql security definer set search_path='' as $$
declare job public.ai_requests;message uuid;begin
 select * into job from public.ai_requests where id=request_id for update;
 if not found or job.status<>'pending' then raise exception 'Request unavailable';end if;
 if error_message is null then
 if answer is null or length(answer)=0 then raise exception 'Empty answer';end if;
 insert into public.ai_messages(conversation_id,role,content) values(job.conversation_id,'assistant',answer) returning id into message;
 end if;
 update public.ai_requests set status=case when error_message is null then 'completed' else 'failed' end,response_id=message where id=request_id;
 update public.usage_events set tokens=greatest(0,coalesce(token_count,0)),error=error_message where id=job.usage_id;
end$$;
revoke all on function public.begin_ai_request(uuid,uuid,uuid,text,text),public.finish_ai_request(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.begin_ai_request(uuid,uuid,uuid,text,text),public.finish_ai_request(uuid,text,integer,text) to service_role;

