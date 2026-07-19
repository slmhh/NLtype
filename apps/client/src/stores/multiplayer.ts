import { useState, useCallback, useEffect, useRef } from "react";
import { wsClient } from "../services/websocket";
import type {
  RoomInfo,
  RoomSettings,
  GameMode,
  PlayerInfo,
  GameSyncPayload,
  PlayerResult,
  WSMessage,
} from "../types/multiplayer";

export interface MultiplayerState {
  connected: boolean;
  rooms: RoomInfo[];
  currentRoom: RoomInfo | null;
  gameText: string;
  gameStarted: boolean;
  countdown: number;
  syncData: GameSyncPayload | null;
  results: PlayerResult[];
}

const defaultState: MultiplayerState = {
  connected: false,
  rooms: [],
  currentRoom: null,
  gameText: "",
  gameStarted: false,
  countdown: 0,
  syncData: null,
  results: [],
};

export function useMultiplayer() {
  const [state, setState] = useState<MultiplayerState>(defaultState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const addHandler = (type: string, fn: (msg: WSMessage) => void) => {
      const unsub = wsClient.on(type, fn);
      unsubs.push(unsub);
    };

    addHandler("room:created", (msg) => {
      setState((s) => ({ ...s, currentRoom: msg.payload }));
    });

    addHandler("room:joined", (msg) => {
      setState((s) => ({ ...s, currentRoom: msg.payload }));
    });

    addHandler("room:left", () => {
      setState((s) => ({ ...s, currentRoom: null, gameStarted: false, gameText: "", syncData: null, results: [] }));
    });

    addHandler("room:update", (msg) => {
      setState((s) => ({ ...s, currentRoom: msg.payload }));
    });

    addHandler("room:list", (msg) => {
      setState((s) => ({ ...s, rooms: msg.payload || [] }));
    });

    addHandler("game:countdown", (msg) => {
      setState((s) => ({ ...s, countdown: msg.payload.count }));
    });

    addHandler("game:starting", (msg) => {
      setState((s) => ({
        ...s,
        gameStarted: true,
        gameText: msg.payload.text,
        countdown: 0,
      }));
    });

    addHandler("game:sync", (msg) => {
      setState((s) => ({ ...s, syncData: msg.payload }));
    });

    addHandler("game:result", (msg) => {
      setState((s) => ({ ...s, results: msg.payload.results || [] }));
    });

    addHandler("error", (msg) => {
      console.error("WS error:", msg.payload?.message || msg.payload);
    });

    setState((s) => ({ ...s, connected: true }));

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  const createRoom = useCallback((settings: Partial<RoomSettings>) => {
    wsClient.send("room:create", {
      mode: settings.mode || "race",
      textSource: settings.textSource || "words",
      duration: settings.duration || 60,
      maxPlayers: settings.maxPlayers || 8,
      password: settings.password || "",
      aiEnabled: settings.aiEnabled || false,
      aiCount: settings.aiCount || 0,
    });
  }, []);

  const joinRoom = useCallback((code: string, password?: string) => {
    wsClient.send("room:join", { code, password });
  }, []);

  const leaveRoom = useCallback(() => {
    wsClient.send("room:leave");
  }, []);

  const listRooms = useCallback(() => {
    wsClient.send("room:list");
  }, []);

  const setReady = useCallback((ready: boolean) => {
    wsClient.send("room:ready", { ready });
  }, []);

  const startGame = useCallback(() => {
    wsClient.send("game:start");
  }, []);

  const sendProgress = useCallback((progress: { position: number; wpm: number; accuracy: number; finished: boolean }) => {
    wsClient.send("game:progress", progress);
  }, []);

  const sendChat = useCallback((text: string) => {
    wsClient.send("room:chat", { text });
  }, []);

  const requestRematch = useCallback(() => {
    wsClient.send("game:rematch");
  }, []);

  const connect = useCallback((token?: string) => {
    wsClient.connect(token);
    setState((s) => ({ ...s, connected: true }));
  }, []);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
    setState(defaultState);
  }, []);

  return {
    state,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    leaveRoom,
    listRooms,
    setReady,
    startGame,
    sendProgress,
    sendChat,
    requestRematch,
  };
}

export type MultiplayerAPI = ReturnType<typeof useMultiplayer>;
