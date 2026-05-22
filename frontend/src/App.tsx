import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { authApi } from './lib/api';
import { useAuthStore } from './store/auth';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import NL2SQLPage from './pages/NL2SQLPage';
import SheetsPage from './pages/SheetsPage';
import ResearchPage from './pages/ResearchPage';
import TicTacToePage from './pages/TicTacToePage';
import { DigestBanner } from './components/DigestBanner';

export default function App() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    authApi
      .me()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [setUser, setLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-400 text-sm">Loading Amzur AI Chat…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/nl2sql" element={<NL2SQLPage />} />
        <Route path="/sheets" element={<SheetsPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/game" element={<TicTacToePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DigestBanner />
    </BrowserRouter>
  );
}
