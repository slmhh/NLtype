import { NavLink } from "react-router-dom";

export default function LeaderboardPage() {
  return (
    <div className="flex flex-col items-center pt-20 px-4 pb-16 select-none">
      <div className="w-full max-w-xl bg-card rounded-2xl shadow-card p-8 text-center">
        <p className="text-[var(--text-primary)] text-sm tracking-[0.15em] mb-2">
          排行榜
        </p>
        <p className="text-[var(--text-tertiary)] text-[11px] tracking-wider">
          即将推出
        </p>
        <NavLink to="/" className="inline-block mt-6 text-[var(--accent)] text-xs tracking-[0.15em] hover:underline">
          ← 返回游戏
        </NavLink>
      </div>
    </div>
  );
}
