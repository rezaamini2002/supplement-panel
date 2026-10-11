"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const ProfileContext = createContext<Profile | null>(null);

export function useProfile(): Profile {
  const p = useContext(ProfileContext);
  if (!p) throw new Error("ProfileContext missing");
  return p;
}

const NAV = [
  { href: "/", label: "داشبورد" },
  { href: "/products", label: "محصولات" },
  { href: "/purchasing", label: "لیست خرید" },
  { href: "/vendors", label: "همکاران" },
  { href: "/notifications", label: "اعلان‌ها" },
];

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    async function load() {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (active) setUnread(count ?? 0);
    }
    load();
    const t = setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("notifications-changed", onFocus);
    return () => {
      active = false;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("notifications-changed", onFocus);
    };
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/products" ? pathname.startsWith("/product") : pathname.startsWith(href);
  const roleLabel = profile.role === "owner" ? "کارفرما" : "مسئول خرید";

  return (
    <ProfileContext.Provider value={profile}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <div className="font-bold">پنل خرید مکمل</div>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`relative rounded-lg px-3 py-2 text-sm ${
                  isActive(n.href) ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {n.label}
                {n.href === "/notifications" && unread > 0 && (
                  <span className="mr-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{unread}</span>
                )}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-500 sm:inline">
              {profile.full_name || roleLabel} · {roleLabel}
            </span>
            <button onClick={signOut} className="btn-ghost !min-h-[36px] !px-3">
              خروج
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:pb-8">{children}</main>

      {/* ناوبری پایین برای موبایل */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`relative py-3 text-center text-xs ${
              isActive(n.href) ? "font-bold text-emerald-700" : "text-slate-600"
            }`}
          >
            {n.label}
            {n.href === "/notifications" && unread > 0 && (
              <span className="absolute left-2 top-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">
                {unread}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </ProfileContext.Provider>
  );
}
