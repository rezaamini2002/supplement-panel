/** @type {import('next').NextConfig} */
// سایت ایستا (static export) برای میزبانی رایگان روی GitHub Pages.
// آدرس نهایی: https://<نام‌کاربری>.github.io/<نام‌مخزن>/
const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
