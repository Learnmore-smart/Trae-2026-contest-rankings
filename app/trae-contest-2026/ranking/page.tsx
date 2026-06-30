import ContestClient from "../contest-client";

export const metadata = {
  title: "TRAE AI 创造力大赛 · 榜单"
};

export default function TraeContestRankingPage() {
  return <ContestClient activeTab="ranking" />;
}
