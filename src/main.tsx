import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { APP } from './config/app';
import { applyTheme } from './lib/theme';
import './styles/global.css';

applyTheme();
document.title = APP.name;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* # links (…/simdesk/#/s/…) so GitHub Pages only ever serves index.html: refreshes and shared links never hit a 404. */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
