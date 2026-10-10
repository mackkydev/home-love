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
    <html lang="th" className={notoThai.variable}>
      <body>{children}</body>
    </html>
  );
}
