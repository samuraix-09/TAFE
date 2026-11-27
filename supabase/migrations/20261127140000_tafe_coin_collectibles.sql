alter table public.tafe_coin_wallets
  drop constraint tafe_coin_wallets_theme_check,
  add constraint tafe_coin_wallets_theme_check
    check (theme in ('classic', 'aurora', 'midnight', 'nebula', 'atlas', 'jade'));

create or replace function public.tafe_coin_wallet()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare learner uuid := auth.uid();
begin
  if not public.account_active(learner) then raise exception 'Account unavailable'; end if;
  return jsonb_build_object(
    'balance', coalesce((select balance from public.tafe_coin_wallets where user_id = learner), 0),
    'theme', coalesce((select theme from public.tafe_coin_wallets where user_id = learner), 'classic'),
    'owned', (select coalesce(jsonb_agg(item), '[]'::jsonb) from public.tafe_coin_events
      where user_id = learner and (reference = 'theme:' || item or reference in ('badge:scholar', 'feature:background', 'feature:study_timer'))),
    'history', (select coalesce(jsonb_agg(to_jsonb(recent) order by recent.created_at desc), '[]'::jsonb)
      from (select item, amount, created_at from public.tafe_coin_events
        where user_id = learner order by created_at desc, reference limit 10) recent)
  );
end $$;

create or replace function public.tafe_coin_purchase(product text, request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare learner uuid := auth.uid();
declare price integer;
declare receipt text;
declare focus_plan uuid;
begin
  if not public.account_active(learner) then raise exception 'Account unavailable'; end if;
  if request_id is null then raise exception 'Invalid purchase'; end if;
  case product
    when 'aurora' then price := 90; receipt := 'theme:aurora';
    when 'midnight' then price := 150; receipt := 'theme:midnight';
    when 'nebula' then price := 240; receipt := 'theme:nebula';
    when 'atlas' then price := 185; receipt := 'theme:atlas';
    when 'jade' then price := 220; receipt := 'theme:jade';
    when 'scholar' then price := 210; receipt := 'badge:scholar';
    when 'background' then price := 500; receipt := 'feature:background';
    when 'study_timer' then price := 125; receipt := 'feature:study_timer';
    when 'focus' then price := 300; receipt := 'focus:' || request_id;
    else raise exception 'Invalid purchase';
  end case;

  insert into public.tafe_coin_wallets(user_id) values (learner) on conflict do nothing;
  perform 1 from public.tafe_coin_wallets where user_id = learner for update;
  if exists (select 1 from public.tafe_coin_events where user_id = learner and reference = receipt) then return; end if;

  if product = 'focus' then
    if exists (select 1 from public.subscriptions where user_id = learner and status = 'active' and expires_at > now()) then
      raise exception 'An active or scheduled subscription already exists';
    end if;
    select id into focus_plan from public.plans where name = 'TAFE Focus' and active;
    if focus_plan is null then raise exception 'TAFE Focus is unavailable'; end if;
  end if;

  update public.tafe_coin_wallets set balance = balance - price where user_id = learner and balance >= price;
  if not found then raise exception 'Insufficient TafeCoin'; end if;
  insert into public.tafe_coin_events(user_id, reference, item, amount) values (learner, receipt, product, -price);
  if product = 'focus' then
    insert into public.subscriptions(user_id, plan_id, expires_at)
    values (learner, focus_plan, now() + interval '3 days');
  end if;
end $$;

create or replace function public.set_tafe_coin_theme(product text)
returns void language plpgsql security definer set search_path = '' as $$
declare learner uuid := auth.uid();
begin
  if not public.account_active(learner) then raise exception 'Account unavailable'; end if;
  if product is null or product not in ('classic', 'aurora', 'midnight', 'nebula', 'atlas', 'jade') or
    (product <> 'classic' and not exists (
      select 1 from public.tafe_coin_events where user_id = learner and reference = 'theme:' || product
    )) then raise exception 'Theme is not owned'; end if;

  insert into public.tafe_coin_wallets(user_id, theme) values (learner, product)
  on conflict (user_id) do update set theme = excluded.theme;
end $$;



create function public.can_customize_tafe_background()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.account_active(auth.uid()) and exists (
    select 1 from public.tafe_coin_events
    where user_id = auth.uid() and reference = 'feature:background'
  );
$$;
revoke all on function public.can_customize_tafe_background() from public, anon, authenticated;
grant execute on function public.can_customize_tafe_background() to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('tafe-backgrounds', 'tafe-backgrounds', false, 3145728, array['image/jpeg','image/png','image/webp']);

create policy own_tafe_background on storage.objects for all to authenticated
using (
  bucket_id = 'tafe-backgrounds' and name = auth.uid()::text || '/background'
  and public.can_customize_tafe_background()
)
with check (
  bucket_id = 'tafe-backgrounds' and name = auth.uid()::text || '/background'
  and public.can_customize_tafe_background()
);
