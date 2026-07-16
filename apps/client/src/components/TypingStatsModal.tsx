import { useEffect, useState } from "react";
import { Modal, Spin, Tabs } from "@arco-design/web-react";
import { useAuth } from "../context/AuthContext";
import { getResultStats } from "../services/results";
import { KeyboardHeatmap } from "./KeyboardHeatmap";
import { LatencyChart } from "./LatencyChart";
import { ErrorTable } from "./ErrorTable";
import { useI18n } from "../context/I18nContext";
import type { ResultStats, TypingEvent } from "../types/results";

interface TypingStatsModalProps {
  visible: boolean;
  onClose: () => void;
  resultId: string;
}

export function TypingStatsModal({ visible, onClose, resultId }: TypingStatsModalProps) {
  const { t } = useI18n();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ResultStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible || !token) return;
    const numId = parseInt(resultId, 10);
    if (isNaN(numId)) {
      setError("Invalid result ID");
      return;
    }
    setLoading(true);
    setError("");
    getResultStats(numId, token)
      .then((data) => {
        if (data) {
          setStats(data.stats);
        } else {
          setError("Failed to load stats");
        }
      })
      .catch(() => setError("Failed to load stats"))
      .finally(() => setLoading(false));
  }, [visible, resultId, token]);

  return (
    <Modal
      title={t("stats.detailTitle")}
      visible={visible}
      onCancel={onClose}
      footer={null}
      style={{ width: 640 }}
      unmountOnExit
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin />
        </div>
      ) : error ? (
        <p className="text-red-500 text-center py-8">{error}</p>
      ) : stats ? (
        <Tabs defaultActiveTab="heatmap">
          <Tabs.TabPane key="heatmap" title={t("stats.heatmap")}>
            <div className="py-4">
              <KeyboardHeatmap errorMap={stats.errorMap} keyFrequency={stats.keyFrequency} />
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane key="latency" title={t("stats.latency")}>
            <div className="py-4">
              <div className="flex gap-4 mb-4 text-sm text-gray-500">
                <span>
                  {t("stats.avgLatency")}:{" "}
                  <strong className="text-gray-800">{stats.avgLatencyMs}ms</strong>
                </span>
                <span>
                  {t("stats.maxLatency")}:{" "}
                  <strong className="text-gray-800">{stats.maxLatencyMs}ms</strong>
                </span>
                <span>
                  {t("stats.events")}:{" "}
                  <strong className="text-gray-800">{stats.totalEvents}</strong>
                </span>
              </div>
              <LatencyChart buckets={stats.latencyBuckets} />
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane key="errors" title={t("stats.errors")}>
            <div className="py-4">
              <ErrorTable errorMap={stats.errorMap} totalEvents={stats.totalEvents} />
            </div>
          </Tabs.TabPane>
        </Tabs>
      ) : null}
    </Modal>
  );
}
