export type GameMode = "race" | "time_battle" | "accuracy" | "elimination" | "team_battle" | "marathon" | "chase";

export type RoomStatus = "waiting" | "countdown" | "playing" | "result";

export interface PlayerInfo {
  userId: number;
  username: string;
  progress: number;
  wpm: number;
  accuracy: number;
  position: number;
  eliminated?: boolean;
  team?: string;
  role?: string;
  finished: boolean;
  ready: boolean;
}

export interface RoomSettings {
  mode: GameMode;
  textSource: string;
  duration: number;
  maxPlayers: number;
  password?: string;
  aiEnabled: boolean;
  aiCount: number;
}

export interface RoomInfo {
  id: string;
  code: string;
  name: string;
  status: RoomStatus;
  mode: GameMode;
  players: PlayerInfo[];
  settings: RoomSettings;
  hostId: number;
  createdAt: number;
}

export interface WSMessage {
  type: string;
  payload?: any;
}

export interface GameProgressPayload {
  position: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
}

export interface GameSyncPayload {
  players: PlayerInfo[];
  timeLeft?: number;
}

export interface PlayerResult {
  userId: number;
  username: string;
  progress: number;
  wpm: number;
  accuracy: number;
  position: number;
  eliminated?: boolean;
  team?: string;
  role?: string;
  finished: boolean;
  cpm: number;
  rawWPM: number;
  duration: number;
}
