create table public.tafe_coin_extra_catalog (
  product text primary key,
  category text not null check (category in ('scene','badge','frame','effect','dashboard')),
  price integer not null check (price > 0),
  unique (product, category)
);
create table public.tafe_coin_extra_equipped (
  user_id uuid not null references auth.users on delete cascade,
  category text not null,
  product text not null,
  primary key (user_id, category),
  foreign key (product, category) references public.tafe_coin_extra_catalog(product, category)
);

alter table public.tafe_coin_extra_catalog enable row level security;
alter table public.tafe_coin_extra_equipped enable row level security;
revoke all on public.tafe_coin_extra_catalog, public.tafe_coin_extra_equipped from public, anon, authenticated;

insert into public.tafe_coin_extra_catalog(product, category, price) values
  ('scene_1', 'scene', 145),
  ('scene_2', 'scene', 170),
  ('scene_3', 'scene', 195),
  ('scene_4', 'scene', 220),
  ('scene_5', 'scene', 245),
  ('scene_6', 'scene', 270),
  ('badge_1', 'badge', 85),
  ('badge_2', 'badge', 110),
  ('badge_3', 'badge', 135),
  ('badge_4', 'badge', 160),
  ('badge_5', 'badge', 185),
  ('badge_6', 'badge', 210),
  ('frame_1', 'frame', 110),
  ('frame_2', 'frame', 135),
  ('frame_3', 'frame', 160),
  ('frame_4', 'frame', 185),
  ('frame_5', 'frame', 210),
  ('frame_6', 'frame', 235),
  ('effect_1', 'effect', 120),
  ('effect_2', 'effect', 145),
  ('effect_3', 'effect', 170),
  ('effect_4', 'effect', 195),
  ('effect_5', 'effect', 220),
  ('effect_6', 'effect', 245),
  ('dashboard_1', 'dashboard', 100),
  ('dashboard_2', 'dashboard', 125),
  ('dashboard_3', 'dashboard', 150),
  ('dashboard_4', 'dashboard', 175),
  ('dashboard_5', 'dashboard', 200),
  ('dashboard_6', 'dashboard', 225);

create function public.buy_tafe_coin_extra(item_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare learner uuid := auth.uid();
declare cost integer;
begin
  if not public.account_active(learner) then raise exception 'Account unavailable'; end if;
  select price into cost from public.tafe_coin_extra_catalog where product = item_id;
  if cost is null then raise exception 'Invalid purchase'; end if;

  insert into public.tafe_coin_wallets(user_id) values (learner) on conflict do nothing;
  perform 1 from public.tafe_coin_wallets where user_id = learner for update;
  if exists (select 1 from public.tafe_coin_events where user_id = learner and reference = 'extra:' || item_id)
    then return;
  end if;
  update public.tafe_coin_wallets set balance = balance - cost where user_id = learner and balance >= cost;
  if not found then raise exception 'Insufficient TafeCoin'; end if;
  insert into public.tafe_coin_events(user_id, reference, item, amount)
  values (learner, 'extra:' || item_id, item_id, -cost);
end $$;

create function public.equip_tafe_coin_extra(item_id text, enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare learner uuid := auth.uid();
declare slot text;
begin
  if not public.account_active(learner) then raise exception 'Account unavailable'; end if;
  select category into slot from public.tafe_coin_extra_catalog where product = item_id;
  if slot is null or enabled is null or not exists (
    select 1 from public.tafe_coin_events where user_id = learner and reference = 'extra:' || item_id
  ) then raise exception 'Item is not owned'; end if;
  if enabled then
    insert into public.tafe_coin_extra_equipped(user_id, category, product)
    values (learner, slot, item_id)
    on conflict (user_id, category) do update set product = excluded.product;
  else
    delete from public.tafe_coin_extra_equipped where user_id = learner and category = slot and product = item_id;
  end if;
end $$;

revoke all on function public.buy_tafe_coin_extra(text), public.equip_tafe_coin_extra(text, boolean)
from public, anon, authenticated;
grant execute on function public.buy_tafe_coin_extra(text), public.equip_tafe_coin_extra(text, boolean)
to authenticated;

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
    'equipped', (select coalesce(jsonb_object_agg(category, product), '{}'::jsonb)
      from public.tafe_coin_extra_equipped where user_id = learner),
    'extra_owned', (select coalesce(jsonb_agg(item), '[]'::jsonb)
      from public.tafe_coin_events where user_id = learner and reference = 'extra:' || item),
    'history', (select coalesce(jsonb_agg(to_jsonb(recent) order by recent.created_at desc), '[]'::jsonb)
      from (select item, amount, created_at from public.tafe_coin_events
        where user_id = learner order by created_at desc, reference limit 10) recent)
  );
end $$;

