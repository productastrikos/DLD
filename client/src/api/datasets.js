/**
 * The datasets, bundled into the app.
 *
 * /data/*.csv stays the system of record — `npm run generate` still writes it,
 * and it is still the only place a row is authored. The difference is that Vite
 * now inlines those files as strings at build time instead of a Node process
 * reading them off disk at boot, which is what lets the platform ship as static
 * files with no server behind it.
 *
 * Each tab parses its own copy into memory, so the create/approve workflows
 * mutate freely and a refresh returns to the same clean baseline — the same
 * contract the Express version had, since it never persisted either.
 *
 * This module is the only Vite-specific one in ./api. Parsing lives in
 * tables.js so it can run outside a build too.
 */
import { TABLES, parseTables } from './tables.js';

export { REFERENCE_DATE } from './clock.js';
export { TABLES } from './tables.js';

/* Eager + raw: the CSV text is inlined into the bundle, so there is no fetch to
   wait for and no second round trip before the first screen can render. */
const files = import.meta.glob('../../../data/*.csv', {
  query: '?raw', import: 'default', eager: true,
});

const byName = {};
for (const [filePath, text] of Object.entries(files)) {
  byName[filePath.split('/').pop().replace(/\.csv$/, '')] = text;
}

/* A dataset that never made it into the bundle is a build-configuration
   mistake, and it should be loud at startup rather than silent per screen. */
for (const t of TABLES) {
  if (byName[t] === undefined) {
    throw new Error(`Dataset /data/${t}.csv was not bundled — check the glob in datasets.js.`);
  }
}

/** The bundled datasets, as the app uses them. */
export const loadDb = () => parseTables(byName);
