import ContestClient from "./contest-client";
import "./contest.css";

export const metadata = {
  title: "TRAE AI 创造力大赛 · 第三方 AI 评分榜"
};

export default function TraeContestPage() {
  return <ContestClient activeTab="landing" />;
}
