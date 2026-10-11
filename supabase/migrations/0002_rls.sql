-- =====================================================================
-- امنیت سطح ردیف (RLS) و مجوزها
-- پس از 0001_schema.sql اجرا کنید.
-- =====================================================================

-- فعال‌سازی RLS روی همه جدول‌ها
alter table public.profiles      enable row level security;
alter table public.vendors       enable row level security;
alter table public.products      enable row level security;
alter table public.quotes        enable row level security;
alter table public.audit_log     enable row level security;
alter table public.notifications enable row level security;

-- مجوزها: کاربر ناشناس (anon) هیچ دسترسی‌ای ندارد
revoke all on public.profiles, public.vendors, public.products, public.quotes,
              public.audit_log, public.notifications from anon, public;
revoke all on public.profiles, public.vendors, public.products, public.quotes,
              public.audit_log, public.notifications from authenticated;

grant select on public.profiles to authenticated;                       -- فقط خواندن؛ نقش قابل تغییر نیست
grant select, insert, update on public.vendors to authenticated;        -- بدون حذف
grant select, insert, update on public.products to authenticated;       -- بدون حذف (بایگانی)
grant select, insert, update on public.quotes to authenticated;         -- بدون حذف (تاریخچه حفظ می‌شود)
grant select on public.audit_log to authenticated;
grant select, update on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- profiles: هر کاربر فقط پروفایل خودش را می‌بیند؛ هیچ‌کس از طریق API تغییرش نمی‌دهد
-- ---------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- ---------------------------------------------------------------------
-- vendors: هر دو نقش می‌توانند ببینند، بسازند و ویرایش کنند
-- ---------------------------------------------------------------------
create policy vendors_select on public.vendors
  for select to authenticated
  using (public.current_app_role() in ('owner', 'buyer'));

create policy vendors_insert on public.vendors
  for insert to authenticated
  with check (public.current_app_role() in ('owner', 'buyer'));

create policy vendors_update on public.vendors
  for update to authenticated
  using (public.current_app_role() in ('owner', 'buyer'))
  with check (public.current_app_role() in ('owner', 'buyer'));

-- ---------------------------------------------------------------------
-- products: دیدن برای هر دو؛ ساخت فقط کارفرما؛
-- ویرایش برای هر دو، اما تریگر guard_product_update محدودیت ستونی مسئول خرید را اعمال می‌کند
-- ---------------------------------------------------------------------
create policy products_select on public.products
  for select to authenticated
  using (public.current_app_role() in ('owner', 'buyer'));

create policy products_insert on public.products
  for insert to authenticated
  with check (public.current_app_role() = 'owner');

create policy products_update on public.products
  for update to authenticated
  using (public.current_app_role() in ('owner', 'buyer'))
  with check (public.current_app_role() in ('owner', 'buyer'));

-- ---------------------------------------------------------------------
-- quotes: دیدن برای هر دو؛ ثبت و ویرایش فقط مسئول خرید
-- ---------------------------------------------------------------------
create policy quotes_select on public.quotes
  for select to authenticated
  using (public.current_app_role() in ('owner', 'buyer'));

create policy quotes_insert on public.quotes
  for insert to authenticated
  with check (public.current_app_role() = 'buyer');

create policy quotes_update on public.quotes
  for update to authenticated
  using (public.current_app_role() = 'buyer')
  with check (public.current_app_role() = 'buyer');

-- ---------------------------------------------------------------------
-- audit_log: فقط کارفرما می‌خواند؛ نوشتن فقط از طریق تریگرها
-- ---------------------------------------------------------------------
create policy audit_select_owner on public.audit_log
  for select to authenticated
  using (public.current_app_role() = 'owner');

-- ---------------------------------------------------------------------
-- notifications: هر نقش فقط اعلان‌های خودش را می‌بیند و می‌تواند «خوانده شد» بزند
-- ---------------------------------------------------------------------
create policy notifications_select on public.notifications
  for select to authenticated
  using (for_role = public.current_app_role());

create policy notifications_update on public.notifications
  for update to authenticated
  using (for_role = public.current_app_role())
  with check (for_role = public.current_app_role());

-- فقط ستون read_at قابل تغییر باشد
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- توابع داخلی نباید از طریق API عمومی قابل فراخوانی باشند
-- ---------------------------------------------------------------------
revoke all on function public.guard_product_update()  from public, anon, authenticated;
revoke all on function public.guard_product_insert()  from public, anon, authenticated;
revoke all on function public.log_change()            from public, anon, authenticated;
revoke all on function public.notify_new_product()    from public, anon, authenticated;
revoke all on function public.notify_new_quote()      from public, anon, authenticated;
revoke all on function public.notify_decision()       from public, anon, authenticated;
