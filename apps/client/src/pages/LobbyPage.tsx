import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Button, Modal, Select, Message } from "@arco-design/web-react";
import { useMultiplayer } from "../stores/multiplayer";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../context/AuthContext";
import type { GameMode } from "../types/multiplayer";

function useModeOptions(t: (k: string) => string) {
  return [
    { id: "race" as GameMode, label: t("mode.race") },
    { id: "time_battle" as GameMode, label: t("mode.time_battle") },
    { id: "accuracy" as GameMode, label: t("mode.accuracy") },
    { id: "elimination" as GameMode, label: t("mode.elimination") },
    { id: "team_battle" as GameMode, label: t("mode.team_battle") },
    { id: "marathon" as GameMode, label: t("mode.marathon") },
    { id: "chase" as GameMode, label: t("mode.chase") },
  ];
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { token } = useAuth();
  const { state, connect, createRoom, joinRoom, listRooms } = useMultiplayer();
  const MODES = useModeOptions(t);
  const [joinCode, setJoinCode] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newMode, setNewMode] = useState<GameMode>("race");
  const [newDuration, setNewDuration] = useState(60);
  const [mounted, setMounted] = useState(false);
  const connectedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    if (!connectedRef.current) {
      connect(token || undefined);
      connectedRef.current = true;
    }
    listRooms();
    const interval = setInterval(() => listRooms(), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (state.currentRoom && state.gameStarted) {
      navigate("/multiplayer/game", { state: { room: state.currentRoom } });
    }
  }, [state.currentRoom, state.gameStarted, navigate]);

  const handleCreate = useCallback(() => {
    createRoom({
      mode: newMode,
      duration: newDuration,
      maxPlayers: newMode === "chase" ? 2 : newMode === "marathon" ? 100 : 8,
    });
    setCreateOpen(false);
  }, [createRoom, newMode, newDuration]);

  const handleJoin = useCallback(() => {
    if (!joinCode.trim()) return;
    joinRoom(joinCode.trim().toUpperCase());
  }, [joinRoom, joinCode]);

  const fade = `transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`;

  if (!state.connected) {
    return (
      <div className="flex items-center justify-center pt-32">
        <div className="text-[var(--text-tertiary)] text-sm tracking-wider">{t("multiplayer.connecting")}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-12 px-4 pb-16 select-none">
      <div className={`w-full max-w-[780px] ${fade}`} style={{ transitionDelay: "0ms" }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-[0.08em] text-[var(--text-primary)]">{t("multiplayer.title")}</h1>
            <p className="text-[var(--text-tertiary)] text-xs tracking-[0.15em] mt-1">{state.rooms.length} {t("multiplayer.activeRooms")}</p>
          </div>
          <div className="flex gap-3">
            <Button type="primary" onClick={() => setCreateOpen(true)}
              className="!rounded-xl !text-sm !tracking-wider">
              + {t("multiplayer.createRoom")}
            </Button>
          </div>
        </div>

        {/* Join by code */}
        <div className="flex items-center gap-3 mb-8 p-4 rounded-xl bg-[var(--bg-alt)] border border-[var(--border)]">
          <Input
            value={joinCode}
            onChange={(v) => setJoinCode(v.toUpperCase())}
            placeholder={t("multiplayer.roomCode")}
            maxLength={6}
            className="!font-mono !tracking-widest !w-32 !text-center"
          />
          <Button type="outline" onClick={handleJoin} disabled={joinCode.length < 4}
            className="!rounded-xl !text-sm !tracking-wider">
            {t("multiplayer.join")}
          </Button>
          <span className="text-[var(--text-tertiary)] text-xs ml-2 tracking-wider">{t("multiplayer.or")}</span>
          <Button type="secondary" onClick={() => createRoom({ mode: newMode })}
            className="!rounded-xl !text-sm !tracking-wider">
            {t("multiplayer.quickMatch")}
          </Button>
        </div>

        {/* Room list */}
        <div className="space-y-2">
          {state.rooms.length === 0 && (
            <div className="text-center py-16 text-[var(--text-tertiary)] text-sm tracking-wider">
              {t("multiplayer.noRooms")}
            </div>
          )}
          {state.rooms.map((room) => (
            <div key={room.id}
              className="flex items-center justify-between p-4 rounded-xl bg-card border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all cursor-pointer"
              onClick={() => joinRoom(room.code)}>
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono font-bold text-[var(--accent)] tracking-wider">{room.code}</span>
                <span className="text-sm text-[var(--text-primary)]">{room.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-mono">
                  {MODES.find((m) => m.id === room.mode)?.label || room.mode}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                <span>{room.players.length}/{room.settings.maxPlayers}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        title={t("multiplayer.createRoom")}
        visible={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        className="!rounded-2xl"
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs text-[var(--text-tertiary)] tracking-wider block mb-2">{t("multiplayer.mode")}</label>
            <Select value={newMode} onChange={(v) => setNewMode(v as GameMode)}
              className="!w-full">
              {MODES.map((m) => (
                <Select.Option key={m.id} value={m.id}>{m.label}</Select.Option>
              ))}
            </Select>
          </div>
          {newMode !== "marathon" && newMode !== "chase" && (
            <div>
              <label className="text-xs text-[var(--text-tertiary)] tracking-wider block mb-2">{t("multiplayer.duration")}</label>
              <div className="flex gap-2">
                {[30, 60, 120].map((d) => (
                  <button key={d} onClick={() => setNewDuration(d)}
                    className={`px-4 py-1.5 text-sm rounded-lg transition-all font-mono ${
                      newDuration === d ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--bg-alt)] text-[var(--text-tertiary)]"
                    }`}>
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
