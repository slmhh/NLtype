import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Modal, Button, Tooltip } from "@arco-design/web-react";
import { useMultiplayer } from "../stores/multiplayer";
import { useI18n } from "../context/I18nContext";
import { TypingDisplay } from "../components/TypingDisplay";
import type { PlayerInfo, RoomInfo, GameMode, ItemType } from "../types/multiplayer";
import { getItemDef, getAllItemDefs } from "../data/items";



function getMode(mpState: any, roomData: any): GameMode {
  return mpState.syncData?.mode || roomData?.mode || "race";
}

export default function MultiplayerGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { state: mpState, sendProgress, leaveRoom, requestRematch, useItem } = useMultiplayer();
  const roomData: RoomInfo | null = (location.state as any)?.room || mpState.currentRoom;
  const mode = getMode(mpState, roomData);

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
  const elapsedRef = useRef(0);

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
    const deps = stateSnapshotRef.current;
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
    if (deps.startTime === null) setStartTime(now);
    const elapsed = deps.startTime === null ? 0 : now - deps.startTime;
    elapsedRef.current = elapsed;

    setChars((prev) => {
      if (deps.finished) return prev;
      const idx = deps.currentIndex;
      if (idx >= prev.length) return prev;
      const expected = prev[idx].char;
      const correct = e.key === expected;
      return prev.map((ch, i) =>
        i === idx ? { ...ch, typed: e.key, status: correct ? "correct" : "incorrect" as const } : ch
      );
    });

    const idx = deps.currentIndex;
    const isCorrect = idx < deps.text.length && e.key === deps.text[idx];
    const newCorrect = deps.correctCount + (isCorrect ? 1 : 0);
    const newIncorrect = deps.incorrectCount + (isCorrect ? 0 : 1);
    setCorrectCount(newCorrect);
    setIncorrectCount(newIncorrect);

    const newIdx = idx + 1;
    setCurrentIndex(newIdx);

    const newWpm = updateWpm(newCorrect, elapsed);
    const total = newCorrect + newIncorrect;
    const newAcc = total > 0 ? Math.round((newCorrect / total) * 10000) / 100 : 100;
    setWpm(newWpm);
    setAccuracy(newAcc);

    const shouldFinish = deps.text.length > 0 && (deps.mode === "marathon" ? false : newIdx >= deps.text.length);
    const isFinished = shouldFinish;
    if (isFinished) {
      finishedRef.current = true;
      setFinished(true);
    }

    sendProgress({
      position: newIdx,
      wpm: newWpm,
      accuracy: newAcc,
      finished: isFinished,
    });
  }, [updateWpm, sendProgress]);

  const stateSnapshotRef = useRef({ currentIndex: 0, correctCount: 0, incorrectCount: 0, startTime: null as number | null, finished: false, text: "", mode: "" });
  stateSnapshotRef.current = { currentIndex, correctCount, incorrectCount, startTime, finished, text, mode };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const handler = () => inputRef.current?.focus();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  const progress = text.length > 0 ? Math.min(100, Math.round((currentIndex / text.length) * 100)) : 0;

  const rankedPlayers = useMemo(() => {
    if (!mpState.syncData?.players) return [];
    // Server already sorts, but client-side sort for responsiveness
    const list = [...mpState.syncData.players];
    if (mode === "accuracy") {
      list.sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0) || (b.wpm || 0) - (a.wpm || 0));
    } else list.sort((a, b) => (b.wpm || 0) - (a.wpm || 0));
    return list;
  }, [mpState.syncData, mode]);

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

  const timeLeft = mpState.syncData?.timeLeft;

  return (
    <div className="flex flex-col items-center pt-4 px-4 pb-16 select-none" style={{ minHeight: "100vh" }}>
      <textarea ref={inputRef} className="absolute opacity-0 w-0 h-0" autoFocus />

      <div className="w-full max-w-[900px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={handleBack} className="text-xs text-[var(--text-tertiary)] tracking-[0.15em] hover:text-[var(--text-secondary)] transition-colors">
            ← {t("game.back")}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-mono tracking-wider">
              {t(`mode.${mode}`)}
            </span>
            {mode === "elimination" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-mono">ELIM 30s</span>
            )}
            {timeLeft !== undefined && timeLeft > 0 && mode !== "marathon" && (
              <span className={`text-lg font-bold font-mono ${timeLeft <= 10 ? "text-[var(--accent-red)]" : "text-[var(--text-primary)]"}`}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
              </span>
            )}
          </div>
          <span className="text-xs text-[var(--text-tertiary)] font-mono">{roomData?.code || ""}</span>
        </div>

        <div className="flex gap-6">
          {/* Left: Text + Stats */}
          <div className="flex-1 min-w-0">
            {/* Chase map */}
            {mode === "chase" && mpState.syncData?.chaseMap && (
              <>
                <ChaseMapView chaseMap={mpState.syncData.chaseMap} />
                <ItemBar items={mpState.myItems} effects={mpState.myEffects} onUse={useItem} />
                {mpState.lastPickup && (() => {
                  const def = getItemDef(mpState.lastPickup.item);
                  return def ? (
                    <div className="mb-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-center text-xs text-green-400 font-mono animate-pulse">
                      + {def.icon} {def.name}!
                    </div>
                  ) : null;
                })()}
              </>
            )}

            {/* Text display */}
            <div className="bg-card rounded-2xl shadow-card p-6 mb-3">
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
              <div className="grid grid-cols-4 gap-2">
                <MiniStat label={t("multiplayer.wpm")} value={String(wpm)} accent />
                <MiniStat label={t("game.accuracy")} value={`${accuracy}%`} accentGreen />
                <MiniStat label={t("game.progress")} value={`${progress}%`} />
                <MiniStat label={t("multiplayer.chars")} value={`${correctCount}/${correctCount + incorrectCount}`} />
              </div>
            )}
          </div>

          {/* Right: Rankings */}
          <div className={`${mode === "chase" ? "w-72" : "w-64"}`}>
            <div className="bg-card rounded-2xl shadow-card p-4">
              <h3 className="text-xs text-[var(--text-tertiary)] tracking-[0.2em] uppercase mb-3 font-mono">
                {mode === "team_battle" ? t("multiplayer.teams") : t("multiplayer.rankings")}
              </h3>

              {mode === "team_battle" ? (
                <>
                  {renderTeamRankings(rankedPlayers)}
                  {rankedPlayers.length === 0 && <EmptyRanking />}
                </>
              ) : (
                <div className="space-y-2">
                  {rankedPlayers.map((p, i) => (
                    <PlayerRankCard key={p.userId} player={p} rank={i + 1} mode={mode} />
                  ))}
                  {rankedPlayers.length === 0 && <EmptyRanking />}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
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
        style={{ maxWidth: 520 }}
        className="!rounded-3xl"
      >
        <div className="text-center pt-4 pb-2">
          <p className="text-[var(--text-tertiary)] text-xs tracking-[0.2em] uppercase mb-1">{t(`mode.${mode}`)}</p>
          <p className="text-[var(--text-tertiary)] text-xs tracking-[0.2em] uppercase mb-4">{t("game.result")}</p>

          {/* Chase result */}
          {mode === "chase" && mpState.chaseResult && (
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
              <p className="text-sm font-bold tracking-wider text-yellow-500">
                {mpState.chaseResult.winnerRole === "cop" ? t("multiplayer.chasePoliceWins") : t("multiplayer.chaseRobberWins")}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                {mpState.chaseResult.reason === "caught" ? t("multiplayer.chaseCaught") :
                 mpState.chaseResult.reason === "escaped" ? t("multiplayer.chaseEscaped") :
                 t("multiplayer.chaseTimeUp")}
              </p>
            </div>
          )}

          {/* Team scores */}
          {mode === "team_battle" && mpState.teamScores.length > 0 && (
            <div className="mb-4 space-y-2">
              {mpState.teamScores.map((ts) => (
                <div key={ts.team} className={`flex items-center justify-between p-2.5 rounded-xl ${
                  ts.team === "red" ? "bg-red-500/5 border border-red-500/10" : "bg-blue-500/5 border border-blue-500/10"
                }`}>
                  <span className={`text-sm font-bold font-mono ${ts.team === "red" ? "text-red-400" : "text-blue-400"}`}>
                    {ts.team === "red" ? "🔴 Red" : "🔵 Blue"}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-primary)]">
                    Avg {Math.round(ts.avgWpm)} wpm · {Math.round(ts.avgAcc)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Player results */}
          {mpState.results.map((r, i) => (
            <div key={r.userId}
              className={`flex items-center justify-between p-3 mb-2 rounded-xl ${
                i === 0 ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-[var(--bg-alt)]"
              }`}>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold font-mono ${
                  i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-[var(--text-tertiary)]"
                }`}>#{i + 1}</span>
                <span className="font-mono text-sm text-[var(--text-primary)]">{r.username}</span>
                {r.eliminated && <span className="text-[10px] text-red-400 font-mono">ELIM</span>}
                {r.team && (
                  <span className={`text-[10px] font-mono ${r.team === "red" ? "text-red-400" : "text-blue-400"}`}>
                    {r.team === "red" ? "🔴" : "🔵"}
                  </span>
                )}
                {r.role && mode === "chase" && (
                  <span className={`text-[10px] font-mono ${r.role === "cop" ? "text-blue-400" : "text-orange-400"}`}>
                    {r.role === "cop" ? "👮" : "🏃"}
                  </span>
                )}
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

function ChaseMapView({ chaseMap }: { chaseMap: { copPosition: number; robberPosition: number; distance: number; mapLength: number; itemPositions?: { position: number; item: string }[] } }) {
  const total = chaseMap.mapLength || 100;
  const copPct = Math.min(100, (chaseMap.copPosition / total) * 100);
  const robberPct = Math.min(100, (chaseMap.robberPosition / total) * 100);
  const close = chaseMap.distance <= 5;

  return (
    <div className={`mb-3 p-3 rounded-xl border transition-all ${
      close ? "border-red-500/30 bg-red-500/5" : "border-[var(--border)] bg-card"
    }`}>
      {close && <p className="text-[10px] text-red-400 font-mono tracking-wider text-center mb-1">⚠ POLICE CLOSE!</p>}
      {/* Track */}
      <div className="relative h-16 bg-[var(--bg-alt)] rounded-lg overflow-hidden">
        {/* Start/Finish labels */}
        <span className="absolute left-1 bottom-0.5 text-[8px] text-[var(--text-tertiary)]">Start</span>
        <span className="absolute right-1 bottom-0.5 text-[8px] text-[var(--text-tertiary)]">Finish</span>

        {/* Item markers */}
        {chaseMap.itemPositions?.map((ip, i) => {
          const pct = Math.min(95, (ip.position / total) * 100);
          return (
            <div key={i} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${pct}%` }}>
              <span className="text-[10px] opacity-60 hover:opacity-100 transition-opacity">{getItemDef(ip.item as ItemType)?.icon || "?"}</span>
            </div>
          );
        })}

        {/* Cop */}
        <div className="absolute top-1 transition-all duration-500" style={{ left: `${copPct}%` }}>
          <div className="flex flex-col items-center">
            <span className="text-sm">👮</span>
            <span className="text-[8px] font-mono text-blue-400">{chaseMap.copPosition}</span>
          </div>
        </div>

        {/* Robber */}
        <div className="absolute bottom-1 transition-all duration-500" style={{ left: `${robberPct}%` }}>
          <div className="flex flex-col items-center">
            <span className="text-sm">🏃</span>
            <span className="text-[8px] font-mono text-orange-400">{chaseMap.robberPosition}</span>
          </div>
        </div>

        {/* Distance */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
            {chaseMap.distance > 0 ? `${chaseMap.distance} steps` : "CAUGHT!"}
          </span>
        </div>
      </div>
    </div>
  );
}

function PlayerRankCard({ player, rank, mode }: { player: PlayerInfo; rank: number; mode: string }) {
  const progress = mode === "chase" ? (player.progress || 0) / 1 : (player.progress || 0);
  const maxP = mode === "chase" ? 100 : 100;
  const pct = Math.min(100, (progress / Math.max(1, maxP)) * 100);

  return (
    <div className={`p-2.5 rounded-xl border transition-all ${
      player.eliminated ? "opacity-40 border-red-500/20 bg-red-500/5" : "border-[var(--border)] bg-[var(--bg-alt)]"
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-bold font-mono shrink-0 ${
            rank === 1 ? "text-yellow-500" : rank === 2 ? "text-gray-400" : rank === 3 ? "text-orange-400" : "text-[var(--text-tertiary)]"
          }`}>#{rank}</span>
          <span className="text-xs text-[var(--text-primary)] font-mono truncate max-w-[70px]">{player.username}</span>
          {player.team && (
            <span className={`text-[9px] ${player.team === "red" ? "text-red-400" : "text-blue-400"}`}>
              {player.team === "red" ? "🔴" : "🔵"}
            </span>
          )}
          {player.role && mode === "chase" && (
            <span className="text-[10px]">{player.role === "cop" ? "👮" : "🏃"}</span>
          )}
          {player.eliminated && <span className="text-[9px] text-red-400 font-mono">ELIM</span>}
        </div>
        <span className="text-xs font-mono text-[var(--accent)] shrink-0 ml-1">{Math.round(player.wpm)}</span>
      </div>
      <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            player.eliminated ? "bg-red-400" : rank === 1 ? "bg-yellow-500" : "bg-[var(--accent)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function renderTeamRankings(players: PlayerInfo[]) {
  const red = players.filter((p) => p.team === "red");
  const blue = players.filter((p) => p.team === "blue");
  const teams = [
    { name: "Red", color: "text-red-400", bg: "bg-red-500/5", border: "border-red-500/10", members: red },
    { name: "Blue", color: "text-blue-400", bg: "bg-blue-500/5", border: "border-blue-500/10", members: blue },
  ];

  return (
    <div className="space-y-3">
      {teams.map((team) => {
        const avgWpm = team.members.length > 0
          ? Math.round(team.members.reduce((s, p) => s + p.wpm, 0) / team.members.length)
          : 0;
        return (
          <div key={team.name} className={`p-2.5 rounded-xl border ${team.bg} ${team.border}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold font-mono ${team.color}`}>
                {team.name === "Red" ? "🔴" : "🔵"} {team.name}
              </span>
              <span className="text-xs font-mono text-[var(--text-primary)]">{avgWpm} avg</span>
            </div>
            {team.members.map((p) => (
              <div key={p.userId} className="flex items-center justify-between py-1">
                <span className="text-xs font-mono text-[var(--text-primary)]">{p.username}</span>
                <span className="text-xs font-mono text-[var(--accent)]">{Math.round(p.wpm)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function EmptyRanking() {
  return (
    <div className="text-center py-6 text-xs text-[var(--text-tertiary)] tracking-wider">
      Waiting for game...
    </div>
  );
}

function ItemBar({ items, effects, onUse }: { items: ItemType[]; effects: string[]; onUse: (item: ItemType) => void }) {
  const allDefs = getAllItemDefs();
  const counts = items.reduce<Record<string, number>>((acc, i) => {
    acc[i] = (acc[i] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mb-3 p-2.5 rounded-xl bg-card border border-[var(--border)]">
      <p className="text-[9px] text-[var(--text-tertiary)] tracking-[0.2em] uppercase mb-2 font-mono">Items</p>
      <div className="flex gap-2">
        {allDefs.map((def) => {
          const count = counts[def.id] || 0;
          const active = effects.includes(def.effectType);
          return (
            <Tooltip key={def.id} content={`${def.icon} ${def.name}: ${def.description}${count > 0 ? "" : " (none)"}`}>
              <button
                onClick={() => { if (count > 0) onUse(def.id); }}
                disabled={count <= 0}
                className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                  active
                    ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]"
                    : count > 0
                    ? "bg-[var(--bg-alt)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)] cursor-pointer"
                    : "bg-[var(--bg-alt)]/50 border-transparent text-[var(--text-tertiary)] opacity-40 cursor-not-allowed"
                }`}
              >
                <span>{def.icon}</span>
                {count > 0 && <span className="font-bold">{count}</span>}
                {active && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--accent)] animate-ping" />}
              </button>
            </Tooltip>
          );
        })}
      </div>
      {effects.length > 0 && (
        <div className="flex gap-1.5 mt-1.5">
          {effects.map((eff) => {
            const def = getAllItemDefs().find((d) => d.effectType === eff || d.id === eff);
            if (!def) return null;
            const colors: Record<string, string> = { speed_boost: "text-blue-400", slow: "text-purple-400", shield: "text-green-400" };
            return <EffectBadge key={eff} icon={def.icon} label={def.effectType.toUpperCase()} color={colors[eff] || "text-[var(--accent)]"} />;
          })}
        </div>
      )}
    </div>
  );
}

function EffectBadge({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono ${color} bg-[var(--accent-soft)]`}>
      {icon} {label}
    </span>
  );
}

function MiniStat({ label, value, accent, accentGreen }: { label: string; value: string; accent?: boolean; accentGreen?: boolean }) {
  return (
    <div className="text-center p-3 rounded-xl bg-card border border-[var(--border)]">
      <div className={`text-xl font-bold font-mono ${
        accent ? "text-[var(--accent)]" : accentGreen ? "text-[var(--accent-green)]" : "text-[var(--text-primary)]"
      }`}>{value}</div>
      <div className="text-xs text-[var(--text-tertiary)] tracking-wider uppercase">{label}</div>
    </div>
  );
}
