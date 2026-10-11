-- =====================================================================
-- پنل خرید مکمل‌های ورزشی — ساختار دیتابیس
-- این فایل را در Supabase > SQL Editor اجرا کنید (یک‌بار).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- پروفایل کاربران (نقش اینجا ذخیره می‌شود و کاربر نمی‌تواند آن را تغییر دهد)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null check (role in ('owner', 'buyer')),
  created_at timestamptz not null default now()
);

-- هر نقش فقط یک حساب داشته باشد (دو حساب مشخص و خصوصی)
create unique index profiles_one_per_role on public.profiles (role);

-- ---------------------------------------------------------------------
-- همکاران / فروشندگان
-- ---------------------------------------------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 30),
  notes text check (notes is null or char_length(notes) <= 1000),
  is_active boolean not null default true,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- محصولات درخواستی
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  brand text check (brand is null or char_length(brand) <= 100),
  variant text check (variant is null or char_length(variant) <= 150),
  quantity_needed integer not null default 1 check (quantity_needed > 0 and quantity_needed <= 1000000),
  target_price bigint not null check (target_price >= 0 and target_price <= 100000000000),
  suggested_vendors text check (suggested_vendors is null or char_length(suggested_vendors) <= 500),
  description text check (description is null or char_length(description) <= 2000),

  -- تصمیم کارفرما
  decision text not null default 'pending' check (decision in ('pending', 'approved', 'rejected')),
  decision_at timestamptz,
  decision_by uuid references auth.users (id),

  -- وضعیت اجرای خرید (مستقل از تصمیم)
  fulfillment_status text not null default 'open' check (fulfillment_status in ('open', 'purchased')),
  purchased_at timestamptz,
  purchased_by uuid references auth.users (id),

  is_archived boolean not null default false,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- خرید فقط برای محصول تأییدشده معنا دارد
  constraint purchased_requires_approval check (fulfillment_status = 'open' or decision = 'approved')
);

create index products_decision_idx on public.products (decision);
create index products_archived_idx on public.products (is_archived);

-- ---------------------------------------------------------------------
-- استعلام‌های قیمت (تاریخچه حفظ می‌شود؛ حذف مجاز نیست)
-- ---------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  price bigint not null check (price >= 0 and price <= 100000000000),
  stock_status text not null default 'unknown' check (stock_status in ('in_stock', 'out_of_stock', 'unknown')),
  available_qty integer check (available_qty is null or (available_qty >= 0 and available_qty <= 1000000)),
  quoted_at timestamptz not null default now(),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_product_idx on public.quotes (product_id, quoted_at desc);
create index quotes_vendor_idx on public.quotes (vendor_id);

-- ---------------------------------------------------------------------
-- تاریخچه تغییرات
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

create index audit_log_record_idx on public.audit_log (table_name, record_id, changed_at desc);

-- ---------------------------------------------------------------------
-- اعلان‌های داخلی
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  for_role text not null check (for_role in ('owner', 'buyer')),
  kind text not null check (kind in ('new_product', 'new_quote', 'decision')),
  message text not null,
  product_id uuid references public.products (id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_role_idx on public.notifications (for_role, created_at desc);

-- =====================================================================
-- توابع کمکی
-- =====================================================================

-- نقش کاربر فعلی (null اگر پروفایل نداشته باشد → هیچ دسترسی‌ای ندارد)
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger vendors_touch before update on public.vendors
  for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger quotes_touch before update on public.quotes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- محافظ تغییرات محصول: قوانین نقش‌ها در سطح دیتابیس
-- ---------------------------------------------------------------------
create or replace function public.guard_product_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r text := public.current_app_role();
begin
  if r is null then
    raise exception 'دسترسی غیرمجاز';
  end if;

  if r = 'buyer' then
    -- مسئول خرید فقط می‌تواند وضعیت اجرا را تغییر دهد
    if (to_jsonb(new) - 'fulfillment_status' - 'purchased_at' - 'purchased_by' - 'updated_at')
       is distinct from
       (to_jsonb(old) - 'fulfillment_status' - 'purchased_at' - 'purchased_by' - 'updated_at') then
      raise exception 'مسئول خرید فقط مجاز به تغییر وضعیت اجرای خرید است';
    end if;
    if new.fulfillment_status = 'purchased' and old.decision <> 'approved' then
      raise exception 'فقط محصول تأییدشده را می‌توان خریداری‌شده ثبت کرد';
    end if;
  end if;

  -- ثبت خودکار زمان و کاربر تصمیم
  if new.decision is distinct from old.decision then
    if r <> 'owner' then
      raise exception 'فقط کارفرما می‌تواند تصمیم خرید را تغییر دهد';
    end if;
    if old.fulfillment_status = 'purchased' then
      raise exception 'محصول خریداری‌شده است و تصمیم آن قابل تغییر نیست';
    end if;
    new.decision_at := case when new.decision = 'pending' then null else now() end;
    new.decision_by := case when new.decision = 'pending' then null else auth.uid() end;
  end if;

  -- ثبت خودکار زمان و کاربر خرید
  if new.fulfillment_status is distinct from old.fulfillment_status then
    if new.fulfillment_status = 'purchased' then
      new.purchased_at := now();
      new.purchased_by := auth.uid();
    else
      new.purchased_at := null;
      new.purchased_by := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger products_guard before update on public.products
  for each row execute function public.guard_product_update();

-- ورود محصول جدید: تصمیم و وضعیت اجرا همیشه با مقدار پیش‌فرض شروع شوند
create or replace function public.guard_product_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.decision := 'pending';
  new.decision_at := null;
  new.decision_by := null;
  new.fulfillment_status := 'open';
  new.purchased_at := null;
  new.purchased_by := null;
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger products_guard_insert before insert on public.products
  for each row execute function public.guard_product_insert();

-- ---------------------------------------------------------------------
-- ثبت تاریخچه تغییرات
-- ---------------------------------------------------------------------
create or replace function public.log_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, changed_by, new_data)
    values (tg_table_name, new.id, 'INSERT', auth.uid(), to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, changed_by, old_data, new_data)
    values (tg_table_name, new.id, 'UPDATE', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_log (table_name, record_id, action, changed_by, old_data)
    values (tg_table_name, old.id, 'DELETE', auth.uid(), to_jsonb(old));
    return old;
  end if;
end;
$$;

create trigger products_audit after insert or update or delete on public.products
  for each row execute function public.log_change();
create trigger quotes_audit after insert or update or delete on public.quotes
  for each row execute function public.log_change();
create trigger vendors_audit after insert or update or delete on public.vendors
  for each row execute function public.log_change();

-- ---------------------------------------------------------------------
-- اعلان‌های خودکار
-- ---------------------------------------------------------------------
create or replace function public.notify_new_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (for_role, kind, message, product_id, created_by)
  values ('buyer', 'new_product', 'محصول جدید ثبت شد: ' || new.name, new.id, auth.uid());
  return new;
end;
$$;

create or replace function public.notify_new_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pname text;
begin
  select name into pname from public.products where id = new.product_id;
  insert into public.notifications (for_role, kind, message, product_id, created_by)
  values ('owner', 'new_quote', 'استعلام جدید برای: ' || coalesce(pname, ''), new.product_id, auth.uid());
  return new;
end;
$$;

create or replace function public.notify_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.decision is distinct from old.decision and new.decision <> 'pending' then
    insert into public.notifications (for_role, kind, message, product_id, created_by)
    values (
      'buyer', 'decision',
      case new.decision when 'approved' then 'خرید تأیید شد: ' else 'عدم نیاز به خرید: ' end || new.name,
      new.id, auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger products_notify_new after insert on public.products
  for each row execute function public.notify_new_product();
create trigger quotes_notify_new after insert on public.quotes
  for each row execute function public.notify_new_quote();
create trigger products_notify_decision after update on public.products
  for each row execute function public.notify_decision();
