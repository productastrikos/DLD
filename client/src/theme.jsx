import React, { createContext, useContext, useEffect, useState } from 'react';

const KEY = 'dld_theme';
const Ctx = createContext({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children }) {
  // Light is the brand hero (pure white / pearl grey ground), so it is default.
  const [theme, setTheme] = useState(() => localStorage.getItem(KEY) || 'light');

  useEffect(() => {
    // The tokens are declared on :root, so <html> is the authority. body keeps
    // a mirror of the attribute for the few selectors that scope off it.
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button className="icon-btn" onClick={toggle} title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        {theme === 'light'
          ? <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          : <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>}
      </svg>
    </button>
  );
}
