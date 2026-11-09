revoke all on public.test_attempts from anon,authenticated; grant select(id,user_id,test_id,started_at,expires_at,submitted_at,score,total,answers) on public.test_attempts to authenticated;
