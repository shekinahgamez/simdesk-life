import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import './styles/mobile.css';
import './styles/stylecheck.css';
import './styles/auth.css';
import { StyleCheck } from './pages/StyleCheck';
import { AppSettings } from './pages/AppSettings';
import { Auth } from './pages/Auth';
import { SetPassword, SignedIn } from './pages/AccountScreens';
import { Toaster } from './components/ui';
import { startTheme } from './lib/theme';
import { useAuth } from './lib/auth';

startTheme();

function useHash() {
  const [hash, setHash] = React.useState(location.hash);
  React.useEffect(() => {
    const on = () => { setHash(location.hash); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

/** Until navigation is built (Phase 2): the account screens, plus #style-check and #app-settings for testing. */
function App() {
  const hash = useHash();
  const auth = useAuth();
  const [recoveryDone, setRecoveryDone] = React.useState(false);
  if (hash === '#app-settings') return <AppSettings />;
  if (hash === '#style-check') return <StyleCheck />;
  if (auth.status === 'loading') return <div className="loading" role="status">Loading…</div>;
  if (auth.status === 'recovery' && !recoveryDone) return <SetPassword onDone={() => setRecoveryDone(true)} />;
  if (auth.status === 'signed-out') return <Auth confirmed={auth.confirmed} />;
  return <SignedIn userId={auth.session.user.id} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>,
);
