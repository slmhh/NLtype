import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@arco-design/web-react";
import { useMultiplayer } from "../stores/multiplayer";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../context/AuthContext";
import type { RoomInfo } from "../types/multiplayer";

export default function RoomPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { user } = useAuth();
  const { state, leaveRoom, setReady, startGame } = useMultiplayer();
  const room: RoomInfo | null = (location.state as any)?.room || state.currentRoom;
  const [ready, setLocalReady] = useState(false);

  useEffect(() => {
    if (!room) {
      navigate("/lobby", { replace: true });
    }
  }, [room, navigate]);

  useEffect(() => {
    if (state.currentRoom?.status === "countdown" || state.currentRoom?.status === "playing") {
      navigate("/multiplayer/game", { state: { room: state.currentRoom } });
    }
  }, [state.currentRoom?.status, navigate]);

  if (!room) return null;

  const isHost = user?.id === room.hostId;
  const allReady = room.players.length >= 2 && room.players.every((p) => p.ready || p.userId === room.hostId);
  const code = room.code;

  const handleReady = () => {
    const next = !ready;
    setLocalReady(next);
    setReady(next);
  };

  const handleLeave = () => {
    leaveRoom();
    navigate("/lobby", { replace: true });
  };

  const handleStart = () => {
    startGame();
  };

  const modeLabels: Record<string, string> = {
    race: "Race",
    time_battle: "Time Battle",
    accuracy: "Accuracy Challenge",
    elimination: "Elimination",
    team_battle: "Team Battle",
    marathon: "Marathon",
    chase: "Cop & Robber",
  };

  return (
    <div className="flex flex-col items-center pt-12 px-4 pb-16 select-none">
      <div className="w-full max-w-[600px]">
        <button onClick={handleLeave} className="text-xs text-[var(--text-tertiary)] tracking-[0.15em] hover:text-[var(--text-secondary)] transition-colors mb-6">
          ← {t("game.back")}
        </button>

        <div className="bg-card rounded-2xl shadow-card p-8">
          {/* Room header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold tracking-wider text-[var(--text-primary)]">#{code}</h1>
              <p className="text-xs text-[var(--text-tertiary)] tracking-wider mt-1">
                {modeLabels[room.mode] || room.mode}
              </p>
            </div>
            <span className="text-xs text-[var(--text-tertiary)] font-mono">
              {room.players.length}/{room.settings.maxPlayers}
            </span>
          </div>

          {/* Players */}
          <div className="space-y-2 mb-8">
            {room.players.map((p) => (
              <div key={p.userId}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-alt)] border border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold font-mono">
                    {p.username[0].toUpperCase()}
                  </span>
                  <div>
                    <span className="text-sm text-[var(--text-primary)] font-mono">{p.username}</span>
                    {p.userId === room.hostId && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 font-mono">HOST</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.ready ? (
                    <span className="text-xs text-[var(--accent-green)]">✓ Ready</span>
                  ) : (
                    <span className="text-xs text-[var(--text-tertiary)]">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {isHost ? (
              <Button type="primary" long onClick={handleStart}
                disabled={!allReady}
                className="!rounded-xl !text-sm !tracking-wider !h-11">
                {t("multiplayer.startGame")}
              </Button>
            ) : (
              <Button type="primary" long onClick={handleReady}
                className={`!rounded-xl !text-sm !tracking-wider !h-11 ${
                  ready ? "!bg-[var(--accent-green)]" : ""
                }`}>
                {ready ? t("multiplayer.ready") : t("multiplayer.clickReady")}
              </Button>
            )}
          </div>
        </div>

        {/* Room code share */}
        <div className="mt-6 p-4 rounded-xl bg-[var(--bg-alt)] border border-[var(--border)] text-center">
          <p className="text-xs text-[var(--text-tertiary)] tracking-wider mb-2">{t("multiplayer.shareCode")}</p>
          <p className="text-2xl font-bold font-mono tracking-[0.3em] text-[var(--accent)]">{code}</p>
        </div>
      </div>
    </div>
  );
}
