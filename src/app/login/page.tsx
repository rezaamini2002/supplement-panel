"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setError("ایمیل یا رمز عبور درست نیست.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold">پنل خرید مکمل</h1>
          <p className="mt-1 text-sm text-slate-500">ورود فقط برای کاربران مجاز</p>
        </div>

        <div>
          <label className="label" htmlFor="email">ایمیل</label>
          <input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="username"
            required
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="password">رمز عبور</label>
          <input
            id="password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "در حال ورود…" : "ورود"}
        </button>
      </form>
    </main>
  );
}
