import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './theme';
import { I18nProvider } from './i18n';
import './index.css';

/* HashRouter, not a path-based router, because the platform ships as static
   files. A path router needs the host to rewrite every unknown URL back to
   index.html; get that rewrite wrong — or deploy into a subdirectory — and
   refreshing a deep link is a 404. Routing inside the hash asks nothing of the
   host, so the build works unchanged at a domain root, in a subfolder, or
   opened straight off disk. The visible cost is a /#/ in the address bar. */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
