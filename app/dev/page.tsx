import { headers } from "next/headers";
import Link from "next/link";
import DevClient from "./dev-client";

export const metadata = {
  title: "TRAE Dev 控制台"
};

function isLocalHost(hostHeader: string | null): boolean {
  const host = hostHeader?.split(":")[0]?.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

export default async function DevPage() {
  const headersList = await headers();
  const host = headersList.get("host");
  const isLocal = isLocalHost(host);

  return (
    <main className="min-h-screen bg-[var(--page-bg)] px-4 py-6 text-stone-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/trae-contest-2026" className="control-button ghost w-fit">
          返回榜单
        </Link>
        <header className="mt-8 border-b border-white/10 pb-6">
          <p className="eyebrow">Local development only</p>
          <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">TRAE /dev 控制台</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-300">
            这个页面只用于本机调试抓取、匹配和评分流程。生产环境请使用 admin token 或 cron secret。
          </p>
        </header>

        {isLocal ? (
          <DevClient />
        ) : (
          <section className="mt-8 rounded-lg border border-red-400/30 bg-red-500/10 p-6 text-red-100">
            /dev 只允许 localhost 访问。当前 Host：{host ?? "unknown"}
          </section>
        )}
      </div>
    </main>
  );
}
