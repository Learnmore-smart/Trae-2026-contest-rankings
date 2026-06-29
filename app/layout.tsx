import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRAE AI 创造力大赛第三方 AI 评分榜",
  description: "由 AI 根据公开帖子内容生成的 TRAE AI 创造力大赛第三方模拟评分榜，仅供学习、观摩和参考。",
  metadataBase: new URL("https://rateministere.com")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
