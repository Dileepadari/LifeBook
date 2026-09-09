/**
 * Route table. Everything but the welcome screen, /auth and the print view
 * renders inside AppShell behind a RequireAuth guard.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { AppShell } from '@/components/layout/AppShell';
import { AuthSkeleton } from '@/components/skeletons/pages';
import { useProfile } from '@/hooks/useLifeData';

import Welcome from '@/pages/Welcome';
import Auth from '@/pages/Auth';
import Onboarding from '@/pages/Onboarding';
import Dashboard from '@/pages/Dashboard';
import PlanDay from '@/pages/PlanDay';
import StudyNow from '@/pages/StudyNow';
import QuizRunner from '@/pages/QuizRunner';
import Resources from '@/pages/Resources';
import Challenges from '@/pages/Challenges';
import Wellness from '@/pages/Wellness';
import Motivation from '@/pages/Motivation';
import Journal from '@/pages/Journal';
import Feed from '@/pages/Feed';
import FeelingLow from '@/pages/FeelingLow';
import LifeBookShelf from '@/pages/LifeBookShelf';
import LifePageView from '@/pages/LifePageView';
import PrintBook from '@/pages/PrintBook';
import OrderBook from '@/pages/OrderBook';
import Analytics from '@/pages/Analytics';
import Badges from '@/pages/Badges';
import Profile from '@/pages/Profile';
import SettingsPage from '@/pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

/**
 * A signed-in user who hasn't finished onboarding has no goals, no targets and
 * no habits, which makes every other screen render zeros. Send them through it
 * once rather than letting them meet an empty dashboard.
 */
function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useProfile();
  if (isLoading) return <AuthSkeleton />;
  if (!profile?.onboarded_at) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/" element={loading ? <AuthSkeleton /> : user ? <Navigate to="/dashboard" replace /> : <Welcome />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

      {/* The print view is deliberately outside AppShell - it renders the whole
          book with no chrome so the browser's own PDF export is the binding. */}
      <Route path="/lifebook/print" element={<RequireAuth><PrintBook /></RequireAuth>} />

      <Route element={<RequireAuth><RequireOnboarding><AppShell /></RequireOnboarding></RequireAuth>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/plan" element={<PlanDay />} />
        <Route path="/study" element={<StudyNow />} />
        <Route path="/study/quiz/:id" element={<QuizRunner />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/wellness" element={<Wellness />} />
        <Route path="/motivation" element={<Motivation />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/feeling-low" element={<FeelingLow />} />
        <Route path="/lifebook" element={<LifeBookShelf />} />
        <Route path="/lifebook/order" element={<OrderBook />} />
        <Route path="/lifebook/:date" element={<LifePageView />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/badges" element={<Badges />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
          <Toaster position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
