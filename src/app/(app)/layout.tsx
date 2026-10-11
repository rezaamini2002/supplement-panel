"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/AppShell";
import type { Profile } from "@/lib/types";

type State = { status: "loading" } | { status: "noprofile" } | { status: "ready"; profile: Profile };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .maybeSingle<Profile>();
      if (!active) return;
      setState(profile ? { status: "ready", profile } : { status: "noprofile" });
    }
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (state.status === "loading") {
    return <p className="py-20 text-center text-slate-500">در حال بارگذاری…</p>;
  }

  // حساب بدون نقش هیچ دسترسی‌ای ندارد (RLS هم در دیتابیس جلوی آن را می‌گیرد)
  if (state.status === "noprofile") {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-sm space-y-3 text-center">
          <h1 className="text-lg font-bold">دسترسی ندارید</h1>
          <p className="text-sm text-slate-600">برای این حساب نقشی تعریف نشده است. با مدیر سیستم تماس بگیرید.</p>
          <button className="btn-ghost w-full" onClick={() => createClient().auth.signOut()}>
            خروج
          </button>
        </div>
      </main>
    );
  }

  return <AppShell profile={state.profile}>{children}</AppShell>;
}
