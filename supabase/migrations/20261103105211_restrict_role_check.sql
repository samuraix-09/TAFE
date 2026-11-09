drop policy published_plans on public.plans;
create policy public_plans on public.plans for select to anon using(active);
create policy member_plans on public.plans for select to authenticated using(active or public.is_admin());
revoke execute on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;

