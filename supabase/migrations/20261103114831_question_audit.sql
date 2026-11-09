create or replace function public.record_admin_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(actor_id,action,entity,entity_id,details) values(auth.uid(),TG_OP,TG_TABLE_NAME,
 coalesce(to_jsonb(NEW)->>'id',to_jsonb(OLD)->>'id',to_jsonb(NEW)->>'question_id',to_jsonb(OLD)->>'question_id',to_jsonb(NEW)->>'user_id',to_jsonb(OLD)->>'user_id'),
 jsonb_build_object('before',case when TG_OP='INSERT' then null else to_jsonb(OLD) end,'after',case when TG_OP='DELETE' then null else to_jsonb(NEW) end));
 if TG_OP='DELETE' then return OLD;end if;return NEW;
end$$;
create trigger audit_question_change after insert or update or delete on public.questions for each row execute function public.record_admin_change();
create trigger audit_answer_change after insert or update or delete on public.answer_keys for each row execute function public.record_admin_change();
create trigger audit_role_change after insert or update or delete on public.user_roles for each row execute function public.record_admin_change();

