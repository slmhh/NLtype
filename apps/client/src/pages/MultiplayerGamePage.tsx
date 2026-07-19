import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Modal, Button, Statistic } from "@arco-design/web-react";
import { useMultiplayer } from "../stores/multiplayer";
import { useI18n } from "../context/I18nContext";
import { TypingDisplay } from "../components/TypingDisplay";
import type { PlayerInfo, PlayerResult } from "../types/multiplayer";

export default function MultiplayerGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { state: mpState, sendProgress, leaveRoom, requestRematch } = useMultiplayer();
  const roomData = (location.state as any)?.room;

  const text = mpState.gameText || "";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [finished, setFinished] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [chars, setChars] = useState<CharInfo[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const finishedRef = useRef(false);

  interface CharInfo {
    char: string;
    typed: string;
    status: "pending" | "correct" | "incorrect";
  }

  useEffect(() => {
    if (!roomData && !mpState.currentRoom) {
      navigate("/lobby", { replace: true });
      return;
    }
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (text) {
      setChars(text.split("").map((c) => ({ char: c, typed: "", status: "pending" as const })));
    }
  }, [text]);

  useEffect(() => {
    if (mpState.results.length > 0 && !showResult) {
      setShowResult(true);
    }
  }, [mpState.results, showResult]);

  const updateWpm = useCallback((correct: number, elapsed: number) => {
    if (elapsed <= 0) return 0;
    return Math.round((correct / 5) / (elapsed / 60000));
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (finishedRef.current || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      setCurrentIndex((prev) => {
        if (prev <= 0) return prev;
        const idx = prev - 1;
        setChars((c) => c.map((ch, i) => i === idx ? { ...ch, typed: "", status: "pending" as const } : ch));
        return idx;
      });
      return;
    }
    if (e.key.length !== 1) return;

    e.preventDefault();
    const now = Date.now();
    if (startTime === null) setStartTime(now);
    const elapsed = startTime === null ? 0 : now - startTime;

    setChars((prev) => {
      if (finished) return prev;
      const idx = currentIndex;
      if (idx >= prev.length) return prev;
      const expected = prev[idx].char;
      const correct = e.key === expected;
      return prev.map((ch, i) =>
        i === idx ? { ...ch, typed: e.key, status: correct ? "correct" : "incorrect" as const } : ch
      );
    });

    const idx = currentIndex;
    const isCorrect = idx < text.length && e.key === text[idx];
    const newCorrect = correctCount + (isCorrect ? 1 : 0);
    const newIncorrect = incorrectCount + (isCorrect ? 0 : 1);
    setCorrectCount(newCorrect);
    setIncorrectCount(newIncorrect);

    const newIdx = idx + 1;
    setCurrentIndex(newIdx);

    const newWpm = updateWpm(newCorrect, elapsed);
    const total = newCorrect + newIncorrect;
    const newAcc = total > 0 ? Math.round((newCorrect / total) * 10000) / 100 : 100;
    setWpm(newWpm);
    setAccuracy(newAcc);

    const isFinished = newIdx >= text.length;
    if (isFinished) {
      finishedRef.current = true;
      setFinished(true);
    }

    // Send progress via WS (throttled)
    sendProgress({
      position: newIdx,
      wpm: newWpm,
      accuracy: newAcc,
      finished: isFinished,
    });
  }, [currentIndex, correctCount, incorrectCount, text, startTime, updateWpm, sendProgress, finished]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Focus input on mount and when clicking
  useEffect(() => {
    const handler = () => inputRef.current?.focus();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  const progress = text.length > 0 ? Math.min(100, Math.round((currentIndex / text.length) * 100)) : 0;

  // Sort players by WPM for ranking
  const rankedPlayers = useMemo(() => {
    if (!mpState.syncData?.players) return [];
    return [...mpState.syncData.players].sort((a, b) => (b.wpm || 0) - (a.wpm || 0));
  }, [mpState.syncData]);

  const myId = roomData?.players?.find((p: PlayerInfo) => true)?.userId;

  const handleBack = useCallback(() => {
    leaveRoom();
    navigate("/lobby", { replace: true });
  }, [leaveRoom, navigate]);

  const handleRematch = useCallback(() => {
    requestRematch();
    setShowResult(false);
    setCurrentIndex(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setWpm(0);
    setAccuracy(100);
    setFinished(false);
    finishedRef.current = false;
    setStartTime(null);
    setChars([]);
  }, [requestRematch]);

  return (
    <div className="flex flex-col items-center pt-4 px-4 pb-16 select-none" style={{ minHeight: "100vh" }}>
      <textarea ref={inputRef} className="absolute opacity-0 w-0 h-0" autoFocus />

      <div className="w-full max-w-[900px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={handleBack} className="text-xs text-[var(--text-tertiary)] tracking-[0.15em] hover:text-[var(--text-secondary)] transition-colors">
            ← {t("game.back")}
          </button>
          {mpState.syncData && mpState.syncData.timeLeft !== undefined && mpState.syncData.timeLeft > 0 && (
            <span className={`text-lg font-bold font-mono ${mpState.syncData.timeLeft <= 10 ? "text-[var(--accent-red)]" : "text-[var(--text-primary)]"}`}>
              {Math.floor(mpState.syncData.timeLeft / 60)}:{String(mpState.syncData.timeLeft % 60).padStart(2, "0")}
            </span>
          )}
          <span className="text-xs text-[var(--text-tertiary)] font-mono">{roomData?.code || ""}</span>
        </div>

        <div className="flex gap-6">
          {/* Text display area */}
          <div className="flex-1">
            <div className="bg-card rounded-2xl shadow-card p-6 mb-4">
              {chars.length > 0 && (
                <div className="leading-relaxed" style={{ fontSize: "1.25rem" }}>
                  <TypingDisplay
                    chars={chars}
                    currentIndex={currentIndex}
                    isFinished={finished}
                  />
                </div>
              )}
              {!text && (
                <div className="text-center py-12 text-[var(--text-tertiary)] text-sm tracking-wider">
                  {t("multiplayer.waitingForGame")}
                </div>
              )}
            </div>

            {/* My stats */}
            {text && (
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-3 rounded-xl bg-card border border-[var(--border)]">
                  <div className="text-xl font-bold text-[var(--accent)] font-mono">{wpm}</div>
                  <div className="text-xs text-[var(--text-tertiary)] tracking-wider uppercase">WPM</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-card border border-[var(--border)]">
                  <div className="text-xl font-bold text-[var(--accent-green)] font-mono">{accuracy}%</div>
                  <div className="text-xs text-[var(--text-tertiary)] tracking-wider uppercase">{t("game.accuracy")}</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-card border border-[var(--border)]">
                  <div className="text-xl font-bold text-[var(--text-primary)] font-mono">{progress}%</div>
                  <div className="text-xs text-[var(--text-tertiary)] tracking-wider uppercase">{t("game.progress")}</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-card border border-[var(--border)]">
                  <div className="text-xl font-bold text-[var(--text-primary)] font-mono">{correctCount}/{correctCount + incorrectCount}</div>
                  <div className="text-xs text-[var(--text-tertiary)] tracking-wider uppercase">{t("game.accuracy")}</div>
                </div>
              </div>
            )}
          </div>

          {/* Player rankings */}
          <div className="w-64">
            <div className="bg-card rounded-2xl shadow-card p-4">
              <h3 className="text-xs text-[var(--text-tertiary)] tracking-[0.2em] uppercase mb-3 font-mono">
                {t("multiplayer.rankings")}
              </h3>
              <div className="space-y-2">
                {rankedPlayers.map((p, i) => (
                  <PlayerRankCard key={p.userId} player={p} rank={i + 1} />
                ))}
                {rankedPlayers.length === 0 && (
                  <div className="text-center py-6 text-xs text-[var(--text-tertiary)] tracking-wider">
                    {t("multiplayer.waiting")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-200"
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Result modal */}
      <Modal
        visible={showResult}
        onCancel={handleBack}
        footer={null}
        closable={false}
        maskClosable={false}
        escToExit={false}
        alignCenter
        style={{ maxWidth: 500 }}
        className="!rounded-3xl"
      >
        <div className="text-center pt-4 pb-2">
          <p className="text-[var(--text-tertiary)] text-xs tracking-[0.2em] uppercase mb-2">{t("game.result")}</p>

          {mpState.results.map((r, i) => (
            <div key={r.userId}
              className={`flex items-center justify-between p-3 mb-2 rounded-xl ${
                i === 0 ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-[var(--bg-alt)]"
              }`}>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold font-mono ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-[var(--text-tertiary)]"}`}>
                  #{i + 1}
                </span>
                <span className="font-mono text-sm text-[var(--text-primary)]">{r.username}</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-[var(--accent)]">{Math.round(r.wpm)} wpm</span>
                <span className="text-[var(--text-tertiary)]">{Math.round(r.accuracy)}%</span>
              </div>
            </div>
          ))}

          <div className="flex gap-2.5 mt-6">
            <Button type="primary" long onClick={handleRematch}
              className="!rounded-xl !text-sm !tracking-wider !font-semibold !h-11">
              {t("multiplayer.rematch")}
            </Button>
            <Button type="outline" long onClick={handleBack}
              className="!rounded-xl !text-sm !tracking-wider !h-11">
              {t("multiplayer.backToLobby")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PlayerRankCard({ player, rank }: { player: PlayerInfo; rank: number }) {
  const progress = player.progress || 0;
  const maxProgress = 100;

  return (
    <div className={`p-2.5 rounded-xl border transition-all ${
      player.eliminated ? "opacity-40 border-red-500/20 bg-red-500/5" : "border-[var(--border)] bg-[var(--bg-alt)]"
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold font-mono ${
            rank === 1 ? "text-yellow-500" : rank === 2 ? "text-gray-400" : rank === 3 ? "text-orange-400" : "text-[var(--text-tertiary)]"
          }`}>#{rank}</span>
          <span className="text-xs text-[var(--text-primary)] font-mono truncate max-w-[80px]">{player.username}</span>
          {player.eliminated && <span className="text-[10px] text-red-400">ELIM</span>}
        </div>
        <span className="text-xs font-mono text-[var(--accent)]">{Math.round(player.wpm)}</span>
      </div>
      <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            player.eliminated ? "bg-red-400" : rank === 1 ? "bg-yellow-500" : "bg-[var(--accent)]"
          }`}
          style={{ width: `${Math.min(100, (progress / Math.max(1, 100)) * 100)}%` }}
        />
      </div>
    </div>
  );
}
