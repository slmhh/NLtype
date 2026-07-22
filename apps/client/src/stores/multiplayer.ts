import { useState, useCallback, useEffect, useRef } from "react";
import { wsClient } from "../services/websocket";
import type {
  RoomInfo,
  RoomSettings,
  GameMode,
  PlayerInfo,
  GameSyncPayload,
  PlayerResult,
  TeamScore,
  ChaseResult,
  ChaseMapState,
  WSMessage,
  ItemType,
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
  teamScores: TeamScore[];
  chaseResult: ChaseResult | null;
  myItems: ItemType[];
  myEffects: string[];
  lastPickup: { item: ItemType; position: number } | null;
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
  teamScores: [],
  chaseResult: null,
  myItems: [],
  myEffects: [],
  lastPickup: null,
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
      const room = msg.payload as RoomInfo;
      if (!wsClient.userId && room?.players?.length > 0) {
        // Guests: identify by looking for the first player with matching username
        // Better: the first player in the list is the creator (host)
        wsClient.userId = room.players[0].userId;
      }
      setState((s) => ({ ...s, currentRoom: msg.payload }));
    });

    addHandler("room:joined", (msg) => {
      const room = msg.payload as RoomInfo;
      if (!wsClient.userId && room?.players?.length > 0) {
        wsClient.userId = room.players[room.players.length - 1]?.userId || room.players[0].userId;
      }
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
      const payload = msg.payload as GameSyncPayload;
      const me = payload?.players?.find((pl: PlayerInfo) => pl.userId === wsClient.userId);
      setState((s) => ({
        ...s,
        syncData: payload,
        myItems: me?.items || [],
        myEffects: me?.effects || [],
      }));
    });

    addHandler("game:item_pickup", (msg) => {
      const p = msg.payload;
      if (p && p.userId === wsClient.userId) {
        setState((s) => ({
          ...s,
          lastPickup: { item: p.item, position: p.position },
        }));
        setTimeout(() => setState((s) => ({ ...s, lastPickup: null })), 2000);
      }
    });

    addHandler("game:item_used", (msg) => {
      const p = msg.payload;
      if (p && p.userId === wsClient.userId && p.effect === "teleport") {
        setState((s) => ({
          ...s,
          lastPickup: { item: p.item, position: p.newPos },
        }));
        setTimeout(() => setState((s) => ({ ...s, lastPickup: null })), 1500);
      }
    });

    addHandler("game:result", (msg) => {
      setState((s) => ({
        ...s,
        results: msg.payload.results || [],
        teamScores: msg.payload.teamScores || [],
        chaseResult: msg.payload.chaseResult || null,
      }));
    });

    addHandler("error", (msg) => {
      if (import.meta.env.DEV) console.warn("WS error:", msg.payload?.message || msg.payload);
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
      aiDifficulty: settings.aiDifficulty || "medium",
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

  const useItem = useCallback((item: ItemType) => {
    wsClient.send("game:use_item", { item });
  }, []);

  const connectHandlerRef = useRef<(() => void) | null>(null);
  const connect = useCallback((token?: string) => {
    if (connectHandlerRef.current) {
      connectHandlerRef.current();
    }
    wsClient.connect(token);
    const unsub = wsClient.on("connect", () => {
      setState((s) => ({ ...s, connected: true }));
    });
    connectHandlerRef.current = unsub;
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
    useItem,
  };
}

export type MultiplayerAPI = ReturnType<typeof useMultiplayer>;
