import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "บ้านใจ | จัดการเรื่องในบ้าน",
  description: "รวมบันทึกของใช้ ค่าใช้จ่าย และสิทธิ์บริการของครอบครัวไว้ในที่เดียว",
  applicationName: "บ้านใจ",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "บ้านใจ" },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#3565f6" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={notoThai.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try {
        const root = document.documentElement;
        const savedTheme = localStorage.getItem('baanjai-theme');
        root.dataset.theme = savedTheme === 'dark' || (savedTheme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        const accent = localStorage.getItem('baanjai-accent');
        if (['blue','violet','green','rose','pink','gray','gold','custom'].includes(accent)) root.dataset.accent = accent;
        root.dataset.palette = localStorage.getItem('baanjai-palette') === 'pastel' ? 'pastel' : 'normal';
        const custom = localStorage.getItem('baanjai-custom-color');
        if (accent === 'custom' && /^#[0-9a-f]{6}$/i.test(custom || '')) root.style.setProperty('--blue', custom);
      } catch (_) {}` }} /></head>
      <body>{children}</body>
    </html>
  );
}
