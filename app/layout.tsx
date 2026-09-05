import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "简投 ApplyPilot｜AI 求职投递工作台",
  description: "一份事实档案，一岗一版简历，覆盖飞书招聘与 Moka 常见申请字段。",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
