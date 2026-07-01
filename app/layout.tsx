import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRAE AI 创造力大赛第三方 AI 评分榜",
  description: "由 AI 根据公开帖子内容生成的 TRAE AI 创造力大赛第三方模拟评分榜，仅供学习、观摩和参考。",
  metadataBase: new URL("https://rateministere.com"),
  icons: {
    icon: "/trae-contest-2026/icons/favicon.ico",
    shortcut: "/trae-contest-2026/icons/favicon.ico"
  }
};

const themeScript = `(function(){try{var s=localStorage.getItem("trae-contest-theme");var t=(s==="light"||s==="dark"||s==="system")?s:"light";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
