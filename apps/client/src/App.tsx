import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { ConfigProvider, Layout } from "@arco-design/web-react";
import { ThemeProvider } from "./context/ThemeContext";
import { I18nProvider } from "./context/I18nContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";
import NavBar from "./components/NavBar";
import HomePage from "./pages/HomePage";
import GamePage from "./pages/GamePage";
import LeaderboardPage from "./pages/LeaderboardPage";
import AdminPage from "./pages/AdminPage";
import EntriesPage from "./pages/EntriesPage";
import DeveloperPage from "./pages/DeveloperPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import DailyPage from "./pages/DailyPage";
import LobbyPage from "./pages/LobbyPage";
import RoomPage from "./pages/RoomPage";
import MultiplayerGamePage from "./pages/MultiplayerGamePage";

function AppLayout() {
  return (
    <Layout className="min-h-screen bg-body">
      <NavBar />
      <Layout.Content className="flex flex-col">
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <LanguageProvider>
          <AuthProvider>
          <ConfigProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/game" element={<GamePage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/entries" element={<EntriesPage />} />
                  <Route path="/developer" element={<DeveloperPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/daily" element={<DailyPage />} />
                  <Route path="/lobby" element={<LobbyPage />} />
                  <Route path="/multiplayer/room" element={<RoomPage />} />
                  <Route path="/multiplayer/game" element={<MultiplayerGamePage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ConfigProvider>
        </AuthProvider>
        </LanguageProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
