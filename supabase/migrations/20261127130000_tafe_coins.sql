create table public.tafe_coin_wallets (
  user_id uuid primary key references auth.users on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  theme text not null default 'classic' check (theme in ('classic', 'aurora', 'midnight'))
);

create table public.tafe_coin_events (
  user_id uuid not null references auth.users on delete cascade,
  reference text not null,
  item text not null,
  amount integer not null check (amount <> 0),
  created_at timestamptz not null default now(),
  primary key (user_id, reference)
);

alter table public.tafe_coin_wallets enable row level security;
alter table public.tafe_coin_events enable row level security;
revoke all on public.tafe_coin_wallets, public.tafe_coin_events from public, anon, authenticated;

create function public.tafe_coin_wallet()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare learner uuid := auth.uid();
begin
  if not public.account_active(learner) then raise exception 'Account unavailable'; end if;
  return jsonb_build_object(
    'balance', coalesce((select balance from public.tafe_coin_wallets where user_id = learner), 0),
    'theme', coalesce((select theme from public.tafe_coin_wallets where user_id = learner), 'classic'),
    'owned', (select coalesce(jsonb_agg(item), '[]'::jsonb) from public.tafe_coin_events
      where user_id = learner and reference in ('theme:aurora', 'theme:midnight')),
    'history', (select coalesce(jsonb_agg(to_jsonb(recent) order by recent.created_at desc), '[]'::jsonb)
      from (select item, amount, created_at from public.tafe_coin_events
        where user_id = learner order by created_at desc, reference limit 10) recent)
  );
end $$;

create function public.claim_tafe_coins()
returns integer language plpgsql security definer set search_path = '' as $$
declare learner uuid := auth.uid();
declare earned integer;
begin
  if not public.account_active(learner) then raise exception 'Account unavailable'; end if;
  insert into public.tafe_coin_wallets(user_id) values (learner) on conflict do nothing;
  perform 1 from public.tafe_coin_wallets where user_id = learner for update;

  with eligible as (
    select distinct on (study_day, a.test_id)
      a.id, a.submitted_at, (a.submitted_at at time zone 'Asia/Tashkent')::date as study_day,
      case when a.score::numeric * 5 >= a.total::numeric * 4 then 15 else 10 end as amount
    from public.test_attempts a
    where a.user_id = learner and a.total >= 10 and a.score::numeric * 2 >= a.total
      and a.test_id <> 'fe816150-8c12-4b3a-b04a-000000000002'
      and a.submitted_at >= greatest('2026-11-27 00:00:00+05'::timestamptz, now() - interval '30 days')
      and a.submitted_at <= now()
    order by study_day, a.test_id, a.submitted_at, a.id
  ), ranked as (
    select *, row_number() over (partition by study_day order by submitted_at, id) as position
    from eligible
  ), credited as (
    insert into public.tafe_coin_events(user_id, reference, item, amount)
    select learner, 'exam:' || id, 'exam', amount from ranked where position <= 3
    on conflict do nothing returning amount
  )
  select coalesce(sum(amount), 0)::integer into earned from credited;

  if earned > 0 then
    update public.tafe_coin_wallets set balance = balance + earned where user_id = learner;
  end if;
  return earned;
end $$;

create function public.tafe_coin_purchase(product text, request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare learner uuid := auth.uid();
declare price integer;
declare receipt text;
declare premium_plan uuid;
begin
  if not public.account_active(learner) then raise exception 'Account unavailable'; end if;
  if request_id is null then raise exception 'Invalid purchase'; end if;
  case product
    when 'aurora' then price := 45; receipt := 'theme:aurora';
    when 'midnight' then price := 75; receipt := 'theme:midnight';
    when 'premium' then price := 180; receipt := 'premium:' || request_id;
    else raise exception 'Invalid purchase';
  end case;

  insert into public.tafe_coin_wallets(user_id) values (learner) on conflict do nothing;
  perform 1 from public.tafe_coin_wallets where user_id = learner for update;
  if exists (select 1 from public.tafe_coin_events where user_id = learner and reference = receipt) then return; end if;

  if product = 'premium' then
    if exists (select 1 from public.subscriptions where user_id = learner and status = 'active' and expires_at > now()) then
      raise exception 'An active or scheduled subscription already exists';
    end if;
    select id into premium_plan from public.plans where name = 'TAFE Mastery' and active;
    if premium_plan is null then raise exception 'Premium is unavailable'; end if;
  end if;

  update public.tafe_coin_wallets set balance = balance - price where user_id = learner and balance >= price;
  if not found then raise exception 'Insufficient TafeCoin'; end if;
  insert into public.tafe_coin_events(user_id, reference, item, amount) values (learner, receipt, product, -price);
  if product = 'premium' then
    insert into public.subscriptions(user_id, plan_id, expires_at)
    values (learner, premium_plan, now() + interval '3 days');
  end if;
end $$;

create function public.set_tafe_coin_theme(product text)
returns void language plpgsql security definer set search_path = '' as $$
declare learner uuid := auth.uid();
begin
  if not public.account_active(learner) then raise exception 'Account unavailable'; end if;
  if product is null or product not in ('classic', 'aurora', 'midnight') or
    (product <> 'classic' and not exists (
      select 1 from public.tafe_coin_events where user_id = learner and reference = 'theme:' || product
    )) then raise exception 'Theme is not owned'; end if;

  insert into public.tafe_coin_wallets(user_id, theme) values (learner, product)
  on conflict (user_id) do update set theme = excluded.theme;
end $$;

revoke all on function public.tafe_coin_wallet(), public.claim_tafe_coins(),
  public.tafe_coin_purchase(text, uuid), public.set_tafe_coin_theme(text) from public, anon, authenticated;
grant execute on function public.tafe_coin_wallet(), public.claim_tafe_coins(),
  public.tafe_coin_purchase(text, uuid), public.set_tafe_coin_theme(text) to authenticated;
