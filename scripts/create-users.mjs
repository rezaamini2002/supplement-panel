// ساخت دو حساب خصوصی (کارفرما و مسئول خرید) با روش مدیریتی امن.
// این اسکریپت فقط روی کامپیوتر خودتان اجرا می‌شود:  npm run create-users
// به فایل .env.local با SUPABASE_SERVICE_ROLE_KEY نیاز دارد (آن را جایی منتشر نکنید).

import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("فایل .env.local پیدا نشد. ابتدا آن را از روی .env.example بسازید.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const accounts = [
  {
    role: "owner",
    email: process.env.OWNER_EMAIL,
    password: process.env.OWNER_PASSWORD,
    name: process.env.OWNER_NAME || "کارفرما",
  },
  {
    role: "buyer",
    email: process.env.BUYER_EMAIL,
    password: process.env.BUYER_PASSWORD,
    name: process.env.BUYER_NAME || "مسئول خرید",
  },
];

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY باید در .env.local تنظیم شوند.");
  process.exit(1);
}
for (const a of accounts) {
  if (!a.email || !a.password) {
    console.error(`ایمیل و رمز عبور ${a.role} در .env.local خالی است.`);
    process.exit(1);
  }
  if (a.password.length < 10) {
    console.error(`رمز عبور ${a.role} باید حداقل ۱۰ کاراکتر باشد.`);
    process.exit(1);
  }
}
if (accounts[0].email.toLowerCase() === accounts[1].email.toLowerCase()) {
  console.error("ایمیل دو کاربر باید متفاوت باشد.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const a of accounts) {
  const { data, error } = await admin.auth.admin.createUser({
    email: a.email,
    password: a.password,
    email_confirm: true,
  });

  let userId = data?.user?.id;

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
      if (listErr) {
        console.error(`خطا در پیدا کردن کاربر ${a.email}: ${listErr.message}`);
        process.exit(1);
      }
      userId = list.users.find((u) => u.email?.toLowerCase() === a.email.toLowerCase())?.id;
      console.log(`کاربر ${a.email} از قبل وجود داشت؛ فقط نقش او تنظیم می‌شود.`);
    } else {
      console.error(`خطا در ساخت ${a.email}: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(`کاربر ${a.email} ساخته شد.`);
  }

  if (!userId) {
    console.error(`شناسه کاربر ${a.email} پیدا نشد.`);
    process.exit(1);
  }

  const { error: pErr } = await admin
    .from("profiles")
    .upsert({ id: userId, role: a.role, full_name: a.name }, { onConflict: "id" });
  if (pErr) {
    console.error(`خطا در ثبت نقش ${a.role}: ${pErr.message}`);
    process.exit(1);
  }
  console.log(`نقش «${a.role}» برای ${a.email} ثبت شد.`);
}

console.log("\nهر دو حساب آماده است. اکنون می‌توانید از صفحه ورود وارد شوید.");
