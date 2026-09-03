/**
 * Route → module name.
 *
 * The advisory strip and Ask S!a both scope themselves to whichever module the
 * user is in. This lives in its own file rather than in App.jsx because Layout
 * needs it too, and importing it from App would make the two modules circular.
 */
export function moduleForPath(path) {
  if (path.startsWith('/dld/partners')) return 'partners';
  if (path.startsWith('/dld/campaigns')) return 'campaigns';
  if (path.startsWith('/dld/sponsorships')) return 'sponsorships';
  if (path.startsWith('/partner/agreements')) return 'agreements';
  if (path.startsWith('/dld/requests')) return 'requests';
  if (path.startsWith('/dld/events')) return 'events';
  if (path.startsWith('/dld/twin')) return 'twin';
  if (path.startsWith('/dld/simulator')) return 'simulator';
  if (path.startsWith('/dld/kpis')) return 'kpis';
  if (path.startsWith('/dld/copilot')) return 'dashboard';
  if (path.startsWith('/dld/assets') || path.startsWith('/partner/assets')) return 'assets';
  if (path.startsWith('/partner/marketplace')) return 'marketplace';
  if (path.startsWith('/partner/events')) return 'events';
  if (path.startsWith('/partner/twin')) return 'twin';
  if (path.startsWith('/partner')) return 'partner';
  return 'dashboard';
}
