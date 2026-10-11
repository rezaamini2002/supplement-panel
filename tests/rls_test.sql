\set ON_ERROR_STOP on
\set QUIET on

-- شبیه‌سازی حداقل محیط Supabase
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

\i supabase/migrations/0001_schema.sql
\i supabase/migrations/0002_rls.sql
\echo MIGRATIONS OK

grant all on all tables in schema public to service_role;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@x.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'buyer@x.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'stranger@x.com');
insert into public.profiles (id, role, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner', 'O'),
  ('00000000-0000-0000-0000-0000000000b2', 'buyer', 'B');

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
end $$;

create table pg_temp.results (name text, ok boolean);
grant all on pg_temp.results to public;

-- helper: expect statement to fail / succeed
create or replace function pg_temp.expect_fail(name text, stmt text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
    insert into pg_temp.results values (name, false);
  exception when others then
    insert into pg_temp.results values (name, true);
  end;
end $$;
create or replace function pg_temp.expect_ok(name text, stmt text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
    insert into pg_temp.results values (name, true);
  exception when others then
    raise notice 'UNEXPECTED FAILURE in %: %', name, sqlerrm;
    insert into pg_temp.results values (name, false);
  end;
end $$;

-- ---------- کارفرما ----------
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');

select pg_temp.expect_ok('owner can create product',
  $$insert into public.products (name, target_price, quantity_needed) values ('Whey', 1000000, 5)$$);
select pg_temp.expect_ok('owner can add vendor', $$insert into public.vendors (name) values ('Reza')$$);
select pg_temp.expect_fail('owner cannot add quote',
  $$insert into public.quotes (product_id, vendor_id, price) select p.id, v.id, 1 from public.products p, public.vendors v limit 1$$);
select pg_temp.expect_fail('owner cannot delete product', $$delete from public.products$$);
select pg_temp.expect_fail('owner cannot edit own role', $$update public.profiles set role='buyer'$$);
select pg_temp.expect_ok('owner can read audit', $$select * from public.audit_log$$);

-- ---------- مسئول خرید ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');

select pg_temp.expect_ok('buyer can add vendor', $$insert into public.vendors (name) values ('Ali')$$);
select pg_temp.expect_ok('buyer can add quote',
  $$insert into public.quotes (product_id, vendor_id, price, stock_status) select p.id, v.id, 900000, 'in_stock' from public.products p, public.vendors v limit 1$$);
select pg_temp.expect_fail('buyer cannot create product',
  $$insert into public.products (name, target_price) values ('X', 1)$$);
select pg_temp.expect_fail('buyer cannot change decision',
  $$update public.products set decision='approved'$$);
select pg_temp.expect_fail('buyer cannot change target price',
  $$update public.products set target_price=1$$);
select pg_temp.expect_fail('buyer cannot mark purchased before approval',
  $$update public.products set fulfillment_status='purchased'$$);
select pg_temp.expect_fail('buyer cannot delete quote', $$delete from public.quotes$$);
select pg_temp.expect_fail('buyer cannot read audit', $$select 1/(case when count(*)=0 then 0 else 1 end) from public.audit_log$$);
select pg_temp.expect_fail('buyer cannot edit own role', $$update public.profiles set role='owner'$$);

-- ---------- کارفرما تأیید می‌کند ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_ok('owner approves', $$update public.products set decision='approved'$$);

-- ---------- مسئول خرید خرید را ثبت می‌کند ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect_ok('buyer sees approval', $$select 1/(case when count(*)=1 then 1 else 0 end) from public.products where decision='approved'$$);
select pg_temp.expect_ok('buyer marks purchased after approval',
  $$update public.products set fulfillment_status='purchased'$$);
select pg_temp.expect_fail('buyer still cannot rewrite decision after purchase',
  $$update public.products set decision='rejected'$$);

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_fail('owner cannot change decision after purchase',
  $$update public.products set decision='rejected'$$);

-- ---------- کاربر بدون نقش ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select pg_temp.expect_ok('stranger sees 0 products', $$select 1/(case when count(*)=0 then 1 else 0 end) from public.products$$);
select pg_temp.expect_ok('stranger sees 0 quotes', $$select 1/(case when count(*)=0 then 1 else 0 end) from public.quotes$$);
select pg_temp.expect_ok('stranger sees 0 vendors', $$select 1/(case when count(*)=0 then 1 else 0 end) from public.vendors$$);
select pg_temp.expect_fail('stranger cannot insert vendor', $$insert into public.vendors (name) values ('Z')$$);
select pg_temp.expect_fail('stranger cannot insert product', $$insert into public.products (name, target_price) values ('Z', 1)$$);

-- ---------- ناشناس ----------
reset role;
set role anon;
select pg_temp.as_user('');
select pg_temp.expect_fail('anon cannot read products', $$select * from public.products$$);
select pg_temp.expect_fail('anon cannot read quotes', $$select * from public.quotes$$);
select pg_temp.expect_fail('anon cannot read vendors', $$select * from public.vendors$$);
select pg_temp.expect_fail('anon cannot read profiles', $$select * from public.profiles$$);
select pg_temp.expect_fail('anon cannot read notifications', $$select * from public.notifications$$);
select pg_temp.expect_fail('anon cannot insert product', $$insert into public.products (name, target_price) values ('Z', 1)$$);

-- ---------- اعلان‌ها و تاریخچه (با نقش مدیر دیتابیس) ----------
reset role;
select pg_temp.expect_ok('notifications for buyer exist (new product + decision)',
  $$select 1/(case when count(*)>=2 then 1 else 0 end) from public.notifications where for_role='buyer'$$);
select pg_temp.expect_ok('notification for owner exists (new quote)',
  $$select 1/(case when count(*)>=1 then 1 else 0 end) from public.notifications where for_role='owner'$$);
select pg_temp.expect_ok('audit has product insert+updates',
  $$select 1/(case when count(*)>=3 then 1 else 0 end) from public.audit_log where table_name='products'$$);
select pg_temp.expect_ok('decision stamped with user and time',
  $$select 1/(case when decision_at is not null and decision_by is not null and purchased_at is not null then 1 else 0 end) from public.products$$);

-- یک نقش فقط یک حساب
select pg_temp.expect_fail('second owner account rejected',
  $$insert into public.profiles (id, role) values ('00000000-0000-0000-0000-0000000000c3', 'owner')$$);

\echo
\echo ===== RESULTS =====
select case when ok then 'PASS' else 'FAIL' end as status, name from pg_temp.results order by ok, name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from pg_temp.results;
