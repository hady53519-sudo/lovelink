import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './hooks/useAuth';
import { useI18n } from './i18n';
import { isConfigured } from './lib/supabase';
import About from './pages/About';
import Builder from './pages/Builder';
import Dashboard from './pages/Dashboard';
import ExamplePage from './pages/ExamplePage';
import Home from './pages/Home';
import { Privacy, Terms } from './pages/Legal';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import SurprisePage from './pages/SurprisePage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();
  // Without credentials there is nothing to sign in to: show the page, which explains the setup.
  if (!isConfigured) return children;
  if (!ready) {
    return (
      <div className="container page center">
        <div className="spinner" role="status" aria-label={t('common.loading')} />
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<Builder />} />
        <Route path="/edit/:id" element={<RequireAuth><Builder /></RequireAuth>} />
        <Route path="/my" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Route>
      {/* Standalone pages (no site header/footer) */}
      <Route path="/s/:slug" element={<SurprisePage />} />
      <Route path="/example/:theme" element={<ExamplePage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
