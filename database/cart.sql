create table public.ob_cart_items(
 user_id uuid not null default auth.uid() references public.ob_profiles(id),
 variant_id uuid not null references public.ob_variants(id) on delete cascade,
 quantity integer not null check(quantity between 1 and 20),
 primary key(user_id,variant_id)
);
alter table public.ob_cart_items enable row level security;
revoke all on public.ob_cart_items from public,anon,authenticated;
grant select,insert,update,delete on public.ob_cart_items to authenticated;
create policy cart_read on public.ob_cart_items for select to authenticated using(user_id=(select auth.uid()));
create policy cart_add on public.ob_cart_items for insert to authenticated with check(user_id=(select auth.uid()));
create policy cart_edit on public.ob_cart_items for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy cart_delete on public.ob_cart_items for delete to authenticated using(user_id=(select auth.uid()));
