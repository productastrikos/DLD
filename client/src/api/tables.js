/**
 * The dataset table list, and how raw CSV text becomes the `db` the route
 * handlers read.
 *
 * Deliberately free of any Vite-specific import so it loads anywhere: the app
 * feeds it text inlined at build time (see datasets.js), while a test harness
 * can feed it the same files read off disk and get an identical `db`.
 */
import { parseCSV } from './csv.js';

export const TABLES = [
  'developers', 'campaigns', 'participation_requests', 'sponsorships',
  'assets', 'notifications', 'engagement_monthly', 'advisories',
  'projects', 'events', 'event_participations',
];

/** A missing dataset is worth failing loudly on: the alternative is a screen
 *  that renders empty with no clue why. */
export function parseTables(rawByName) {
  const db = {};
  for (const t of TABLES) {
    if (rawByName[t] === undefined) {
      throw new Error(`Dataset /data/${t}.csv is missing — run \`npm run generate\`.`);
    }
    db[t] = parseCSV(rawByName[t]);
  }
  return db;
}
