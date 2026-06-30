import ContestClient from "../contest-client";
import "../contest.css";

export const metadata = {
  title: "TRAE AI 创造力大赛 · 榜单"
};

export default function TraeContestRankingPage() {
  return <ContestClient activeTab="ranking" />;
}
