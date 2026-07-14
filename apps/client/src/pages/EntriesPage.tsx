import { useState, useEffect } from "react";
import { Message, Select, Tag } from "@arco-design/web-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

interface Entry {
  id: number;
  userId: number;
  username: string;
  language: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: number;
}

const LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "code", label: "Code" },
];

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  pending: { color: "orange", label: "待审核" },
  approved: { color: "green", label: "已通过" },
  rejected: { color: "red", label: "已拒绝" },
};

export default function EntriesPage() {
  const { user, token, hasPermission } = useAuth();
  const [tab, setTab] = useState<"submit" | "mine" | "review">("submit");
  const [language, setLanguage] = useState("en");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isReviewer = hasPermission("admin:panel");
  const canReview = tab === "review" && isReviewer;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const isReviewerUser = isReviewer;
    const url = isReviewerUser && tab === "review"
      ? "/api/entries?status=pending"
      : "/api/entries";
    api<{ entries: Entry[] }>(url, { token })
      .then((d) => setEntries(d.entries))
      .catch((e) => Message.error(e.message))
      .finally(() => setLoading(false));
  }, [user, token, tab]);

  const handleSubmit = async () => {
    if (content.trim().length < 10) {
      Message.error("内容至少 10 个字符");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/entries", {
        method: "POST",
        body: { language, content: content.trim() },
        token,
      });
      Message.success("提交成功，等待审核");
      setContent("");
      setMessage("");
    } catch (e: any) {
      Message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (entryId: number, status: "approved" | "rejected") => {
    try {
      await api(`/api/entries/${entryId}/review`, {
        method: "PATCH",
        body: { status },
        token,
      });
      Message.success(status === "approved" ? "已通过" : "已拒绝");
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (e: any) {
      Message.error(e.message);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center pt-20 px-4 select-none">
        <p className="text-[var(--text-tertiary)] text-sm tracking-wider">请先登录</p>
      </div>
    );
  }

  const tabs = [
    { key: "submit" as const, label: "上传词库" },
    { key: "mine" as const, label: "我的提交" },
    ...(isReviewer ? [{ key: "review" as const, label: "审核" }] : []),
  ];

  return (
    <div className="flex flex-col items-center pt-16 px-4 pb-16 select-none">
      <div className="w-full max-w-2xl">
        <h2 className="text-center text-[var(--text-primary)] text-lg tracking-[0.15em] mb-6">词库管理</h2>

        {/* Tabs */}
        <div className="flex mb-6 border-b border-[var(--border)]">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 pb-3 text-sm tracking-[0.15em] transition-colors font-mono ${
                tab === t.key ? "text-[var(--accent)] border-b-2 border-[var(--accent)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}>
              {t.label}{t.key === "review" && entries.length > 0 ? ` (${entries.length})` : ""}
            </button>
          ))}
        </div>

        {tab === "submit" && (
          <div className="bg-card rounded-2xl shadow-card p-8">
            <div className="mb-5">
              <label className="text-[var(--text-tertiary)] text-xs tracking-wider block mb-2">语言</label>
              <Select value={language} onChange={setLanguage}
                options={LANG_OPTIONS}
                className="!w-32" />
            </div>

            <div className="mb-5">
              <label className="text-[var(--text-tertiary)] text-xs tracking-wider block mb-2">内容</label>
              <textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); setMessage(""); }}
                placeholder="在此粘贴或输入词库内容…&#10;&#10;English: 输入单词列表，每行一个&#10;中文: 输入中文语段&#10;Code: 输入代码片段"
                rows={10}
                className="w-full bg-[var(--bg-alt)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text-primary)] font-mono resize-y focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-tertiary)]"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[var(--text-tertiary)] text-xs">{content.length} / 10000</span>
                {message && <span className="text-[var(--accent)] text-xs">{message}</span>}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting || content.trim().length < 10}
              className="w-full py-3 rounded-xl bg-[var(--accent)] text-white text-sm tracking-[0.15em] font-medium hover:opacity-90 disabled:opacity-40 transition-all">
              {submitting ? "提交中…" : "提交词库"}
            </button>
            <p className="text-[var(--text-tertiary)] text-xs text-center mt-2 tracking-wider">
              提交后需管理员或开发者审核通过方可使用
            </p>
          </div>
        )}

        {tab === "mine" && (
          <div className="bg-card rounded-2xl shadow-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-[var(--text-tertiary)] text-sm">加载中...</div>
            ) : entries.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-tertiary)] text-sm">暂无提交记录</div>
            ) : (
              entries.map((e) => (
                <div key={e.id} className="px-5 py-4 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-alt)] transition-colors">
                  <div className="flex items-center gap-3 mb-1">
                    <Tag color={STATUS_TAG[e.status].color} size="small" bordered>
                      {STATUS_TAG[e.status].label}
                    </Tag>
                    <span className="text-[var(--text-tertiary)] text-xs font-mono">{e.language}</span>
                    <span className="text-[var(--text-tertiary)] text-xs ml-auto">
                      {new Date(e.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <pre className="text-sm text-[var(--text-secondary)] font-mono whitespace-pre-wrap line-clamp-3 mt-1">
                    {e.content.slice(0, 200)}{e.content.length > 200 ? "…" : ""}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {canReview && (
          <div className="bg-card rounded-2xl shadow-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-[var(--text-tertiary)] text-sm">加载中...</div>
            ) : entries.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-tertiary)] text-sm">暂无待审核词库</div>
            ) : (
              entries.map((e) => (
                <div key={e.id} className="px-5 py-4 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-alt)] transition-colors">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[var(--text-primary)] text-xs font-mono font-semibold">{e.username}</span>
                    <span className="text-[var(--text-tertiary)] text-xs font-mono">{e.language}</span>
                    <span className="text-[var(--text-tertiary)] text-xs ml-auto">
                      {new Date(e.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <pre className="text-sm text-[var(--text-secondary)] font-mono whitespace-pre-wrap mt-1 mb-3 max-h-32 overflow-y-auto bg-[var(--bg-alt)] rounded-lg p-3">
                    {e.content}
                  </pre>
                  <div className="flex gap-2">
                    <button onClick={() => handleReview(e.id, "approved")}
                      className="px-4 py-1 text-xs rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors font-mono">
                      通过
                    </button>
                    <button onClick={() => handleReview(e.id, "rejected")}
                      className="px-4 py-1 text-xs rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-mono">
                      拒绝
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
