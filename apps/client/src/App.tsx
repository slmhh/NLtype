import { useState, useCallback } from "react";
import HomePage from "./pages/HomePage";
import GamePage from "./pages/GamePage";
import type { GameConfig } from "./pages/HomePage";

type Page = "home" | "game";

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  const handleStart = useCallback((config: GameConfig) => {
    setGameConfig(config);
    setPage("game");
  }, []);

  const handleBack = useCallback(() => {
    setPage("home");
  }, []);

  if (page === "game" && gameConfig) {
    return <GamePage config={gameConfig} onBack={handleBack} />;
  }

  return <HomePage onStart={handleStart} />;
}
