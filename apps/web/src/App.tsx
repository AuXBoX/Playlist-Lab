import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { DashboardPage } from './pages/DashboardPage';
import { ImportPage } from './pages/ImportPage';
import { GenerateMixesPage } from './pages/GenerateMixesPage';
import { PlaylistsPage } from './pages/PlaylistsPage';
import { EditPlaylistsPage } from './pages/EditPlaylistsPage';
import { SharePlaylistsPage } from './pages/SharePlaylistsPage';
import { BackupRestorePage } from './pages/BackupRestorePage';
import { SchedulesPage } from './pages/SchedulesPage';
import { MissingTracksPage } from './pages/MissingTracksPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { CrossImportPage } from './pages/CrossImportPage';

function AppRoutes() {
  const { user, logout } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout user={user} onLogout={logout} />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="cross-import" element={<CrossImportPage />} />
        <Route path="generate" element={<GenerateMixesPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />
        <Route path="playlists/edit" element={<EditPlaylistsPage />} />
        <Route path="playlists/share" element={<SharePlaylistsPage />} />
        <Route path="playlists/backup" element={<BackupRestorePage />} />
        <Route path="playlists/missing" element={<MissingTracksPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
