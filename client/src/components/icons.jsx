import React from 'react';

/* Line-art icon library (24×24 viewBox, currentColor stroke) — design standard. */
export const Ico = ({ children, size = 22, sw = 1.8, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0, ...style }}>
    {children}
  </svg>
);

export const IcoPeople    = (p) => <Ico {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></Ico>;
export const IcoChart     = (p) => <Ico {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Ico>;
export const IcoClock     = (p) => <Ico {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Ico>;
export const IcoCheck     = (p) => <Ico {...p}><polyline points="20 6 9 17 4 12" /></Ico>;
export const IcoTrendUp   = (p) => <Ico {...p}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></Ico>;
export const IcoMegaphone = (p) => <Ico {...p}><path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1z" /><path d="M15 8a5 5 0 010 8" /><path d="M18.5 5a9 9 0 010 14" /></Ico>;
export const IcoHandshake = (p) => <Ico {...p}><path d="M11 17l2 2a1.4 1.4 0 002-2" /><path d="M13 19l2.5 2.5a1.4 1.4 0 002-2L15 17" /><path d="M2 12l3-3 4 4-3 3z" /><path d="M9 13l3.5 3.5" /><path d="M22 12l-3-3-4 4" /><path d="M5 9l4-4 3 2 3-2 4 4" /></Ico>;
export const IcoCalendar  = (p) => <Ico {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Ico>;
export const IcoFolder    = (p) => <Ico {...p}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></Ico>;
export const IcoBell      = (p) => <Ico {...p}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></Ico>;
export const IcoSearch    = (p) => <Ico {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Ico>;
export const IcoBuilding  = (p) => <Ico {...p}><rect x="4" y="2" width="16" height="20" rx="1" /><line x1="9" y1="6" x2="9.01" y2="6" /><line x1="15" y1="6" x2="15.01" y2="6" /><line x1="9" y1="10" x2="9.01" y2="10" /><line x1="15" y1="10" x2="15.01" y2="10" /><line x1="9" y1="14" x2="9.01" y2="14" /><line x1="15" y1="14" x2="15.01" y2="14" /><path d="M9 22v-4h6v4" /></Ico>;
export const IcoUpload    = (p) => <Ico {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Ico>;
export const IcoDownload  = (p) => <Ico {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Ico>;
export const IcoDoc       = (p) => <Ico {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></Ico>;
export const IcoImage     = (p) => <Ico {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></Ico>;
export const IcoVideo     = (p) => <Ico {...p}><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></Ico>;
export const IcoPackage   = (p) => <Ico {...p}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></Ico>;
export const IcoLock      = (p) => <Ico {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></Ico>;
export const IcoSpark     = (p) => <Ico {...p}><path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" /></Ico>;
export const IcoAlert     = (p) => <Ico {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><circle cx="12" cy="17" r="0.5" fill="currentColor" /></Ico>;
export const IcoClose     = (p) => <Ico {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Ico>;
export const IcoPin       = (p) => <Ico {...p}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></Ico>;
export const IcoTarget    = (p) => <Ico {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Ico>;
export const IcoDollar    = (p) => <Ico {...p}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></Ico>;
export const IcoLayers    = (p) => <Ico {...p}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></Ico>;
export const IcoPlus      = (p) => <Ico {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Ico>;
export const IcoLogout    = (p) => <Ico {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Ico>;
export const IcoInbox     = (p) => <Ico {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></Ico>;

export const IcoGlobe     = (p) => <Ico {...p}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></Ico>;
export const IcoCube      = (p) => <Ico {...p}><path d="M12 2l9 5v10l-9 5-9-5V7z" /><path d="M3 7l9 5 9-5" /><line x1="12" y1="12" x2="12" y2="22" /></Ico>;
export const IcoSliders   = (p) => <Ico {...p}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></Ico>;
export const IcoMessage   = (p) => <Ico {...p}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></Ico>;
export const IcoList      = (p) => <Ico {...p}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></Ico>;
export const IcoTicket    = (p) => <Ico {...p}><path d="M3 9a3 3 0 000 6v3a2 2 0 002 2h14a2 2 0 002-2v-3a3 3 0 010-6V6a2 2 0 00-2-2H5a2 2 0 00-2 2z" /><line x1="13" y1="5" x2="13" y2="19" strokeDasharray="2 3" /></Ico>;
export const IcoAward     = (p) => <Ico {...p}><circle cx="12" cy="8" r="6" /><path d="M8.21 13.89L7 22l5-3 5 3-1.21-8.11" /></Ico>;
export const IcoActivity  = (p) => <Ico {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Ico>;
export const IcoShield    = (p) => <Ico {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Ico>;
export const IcoSend      = (p) => <Ico {...p}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></Ico>;
export const IcoRefresh   = (p) => <Ico {...p}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></Ico>;
export const IcoGrid      = (p) => <Ico {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></Ico>;
export const IcoChevron   = (p) => <Ico {...p}><polyline points="9 18 15 12 9 6" /></Ico>;
export const IcoInfo      = (p) => <Ico {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><circle cx="12" cy="8" r="0.5" fill="currentColor" /></Ico>;
export const IcoExpand    = (p) => <Ico {...p}><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></Ico>;
export const IcoMap       = (p) => <Ico {...p}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></Ico>;
export const IcoCrane     = (p) => <Ico {...p}><line x1="6" y1="21" x2="6" y2="4" /><polyline points="6 4 20 4" /><line x1="20" y1="4" x2="20" y2="9" /><polyline points="2 21 10 21" /><line x1="6" y1="8" x2="13" y2="4" /><line x1="13" y1="9" x2="13" y2="12" /><rect x="11" y="12" width="4" height="3" /></Ico>;
export const IcoKey       = (p) => <Ico {...p}><circle cx="7.5" cy="15.5" r="4.5" /><line x1="10.8" y1="12.2" x2="21" y2="2" /><line x1="17" y1="6" x2="20" y2="9" /><line x1="14" y1="9" x2="17" y2="12" /></Ico>;
export const IcoLeaf      = (p) => <Ico {...p}><path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></Ico>;

/** Asset-type → icon, so the library reads at a glance. */
export const assetIcon = (type) => ({
  image: IcoImage, video: IcoVideo, document: IcoDoc,
  report: IcoChart, 'brand-kit': IcoPackage,
}[type] || IcoDoc);
