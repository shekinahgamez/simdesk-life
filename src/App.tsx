import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useStore } from './store/store';
import { useGameData } from './data/gameData';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui';
import { AuthPage } from './pages/Auth';
import { Loading } from './components/Loading';

const Setup = lazy(() => import('./pages/setup/Setup'));
const SimsPage = lazy(() => import('./pages/Sims'));
const SimProfile = lazy(() => import('./pages/SimProfile'));
const HouseholdsPage = lazy(() => import('./pages/Households'));
const HouseholdPage = lazy(() => import('./pages/Household'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const WorldsPage = lazy(() => import('./pages/Worlds'));
const WorldPage = lazy(() => import('./pages/World'));
const LotPage = lazy(() => import('./pages/Lot'));
const ClubsPage = lazy(() => import('./pages/Clubs'));
const ClubPage = lazy(() => import('./pages/Club'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const AccountPage = lazy(() => import('./pages/Account'));
const StorylinesPage = lazy(() => import('./pages/Storylines'));

export function App() {
  const { ready, backend, init } = useStore();
  const loadGame = useGameData((s) => s.load);

  useEffect(() => {
    void init();
    void loadGame();
  }, [init, loadGame]);

  if (!ready) return <Loading />;
  if (!backend) return (
    <>
      <AuthPage />
      <Toaster />
    </>
  );

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/account" element={<Layout />}>
          <Route index element={<AccountPage />} />
        </Route>
        <Route path="/s/:saveId" element={<SaveGate />}>
          <Route index element={<Navigate to="sims" replace />} />
          <Route path="sims" element={<SimsPage />} />
          <Route path="sims/:simId" element={<SimProfile />} />
          <Route path="households" element={<HouseholdsPage />} />
          <Route path="households/:householdId" element={<HouseholdPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="worlds" element={<WorldsPage />} />
          <Route path="worlds/:worldId" element={<WorldPage />} />
          <Route path="lots/:lotId" element={<LotPage />} />
          <Route path="clubs" element={<ClubsPage />} />
          <Route path="clubs/:clubId" element={<ClubPage />} />
          <Route path="storylines" element={<StorylinesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </Suspense>
  );
}

function Home() {
  const { saves, savesLoaded } = useStore();
  if (!savesLoaded) return <Loading />;
  if (!saves.length) return <Navigate to="/setup" replace />;
  let last: string | null = null;
  try {
    last = localStorage.getItem('sd:lastSave');
  } catch {
    /* ignore */
  }
  const target = saves.find((s) => s.id === last) ?? saves[saves.length - 1];
  return <Navigate to={`/s/${target.id}`} replace />;
}

function SaveGate() {
  const { saveId } = useParams();
  const { saves, savesLoaded, openSave, currentSaveId, loadingSave } = useStore();
  const exists = saves.some((s) => s.id === saveId);
  useEffect(() => {
    if (saveId && exists) void openSave(saveId);
  }, [saveId, exists, openSave]);
  if (!savesLoaded) return <Loading />;
  if (!exists) return <Navigate to="/" replace />;
  if (currentSaveId !== saveId || loadingSave) return <Layout loading />;
  return <Layout />;
}
