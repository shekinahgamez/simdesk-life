import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import './styles/mobile.css';
import './styles/stylecheck.css';
import './styles/auth.css';
import './styles/setup.css';
import './styles/intro.css';
import './styles/sims.css';
import './styles/worlds.css';
import './styles/households.css';
import './styles/rotation.css';
import './styles/calendar.css';
import './styles/photos.css';
import './styles/clubs.css';
import './styles/storylines.css';
import './styles/pieces.css';
import './styles/money.css';
import './styles/commandbar.css';
import './styles/gameimport.css';
import './styles/businesses.css';
import './styles/docs.css';
import './styles/landing.css';
import { StyleCheck } from './pages/StyleCheck';
import { AppSettings } from './pages/AppSettings';
import { Auth } from './pages/Auth';
import { LandingPage, BetaApplyPage } from './pages/landing/Landing';
import { isPretend, PretendApp, SetPassword, SignedIn } from './pages/AccountScreens';
import { Toaster } from './components/ui';
import { startTheme } from './lib/theme';
import { startRipples } from './lib/ripple';
import { useAuth } from './lib/auth';

startTheme();
startRipples();

// Keep a copy of the app on this device so the installed app opens offline (see vite.config.ts → offlineCopy).
if (import.meta.env.PROD && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* not allowed here (e.g. a preview frame) */ }); });
}

function useHash() {
  const [hash, setHash] = React.useState(location.hash);
  React.useEffect(() => {
    const on = () => { setHash(location.hash); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

/** Picks what to show: the app when signed in, log in when not. #style-check is the design check page; #app-settings also works signed out (theme only). */
function App() {
  const hash = useHash();
  const auth = useAuth();
  const [recoveryDone, setRecoveryDone] = React.useState(false);
  // Signed in, App settings opens inside the app (it has account settings too).
  if (hash === '#app-settings' && auth.status === 'signed-out' && !isPretend()) return <AppSettings />;
  if (hash === '#style-check') return <StyleCheck />;
  if (isPretend()) return <PretendApp />;
  if (auth.status === 'loading') return <div className="loading" role="status">Loading…</div>;
  if (auth.status === 'recovery' && !recoveryDone) return <SetPassword onDone={() => setRecoveryDone(true)} />;
  if (auth.status === 'signed-out') {
    // Visitors see the public home page. Beta testers get the sign-in link (#/login) by email; there is no Log in button on the public pages.
    if (auth.confirmed || hash === '#/login') return <Auth confirmed={auth.confirmed} startLogin />;
    if (hash === '#/beta') return <BetaApplyPage />;
    return <LandingPage />;
  }
  return <SignedIn userId={auth.session.user.id} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>,
);
