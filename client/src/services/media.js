/**
 * Imagery for cards that would otherwise be flat colour.
 *
 * Photographs are pulled from Unsplash's CDN and picked *deterministically*
 * from the record's own id — so a campaign card shows the same photograph on
 * every render and every reload. A random pick would make the interface feel
 * unstable in exactly the way a government platform should not.
 *
 * Every image sits under a brand-gradient scrim, so the photo supplies texture
 * while the DLD palette stays dominant. Each pool is themed to what it
 * illustrates rather than being one generic set of skylines.
 */

const CDN = 'https://images.unsplash.com/';

/* Pools, themed by what they illustrate. All ids verified to resolve. */
const POOLS = {
  // Dubai skyline / cityscape — programmes and campaigns
  city: [
    'photo-1512453979798-5ea266f8880c',
    'photo-1518684079-3c830dcef090',
    'photo-1546412414-e1885259563a',
    'photo-1526495124232-a04e1849168c',
    'photo-1582407947304-fd86f028f716',
    'photo-1449824913935-59a10b8d2000',
  ],
  // Architecture and interiors — projects and residential stock
  property: [
    'photo-1580674285054-bed31e145f59',
    'photo-1600585154340-be6161a56a0c',
    'photo-1600607687939-ce8a6c25118c',
    'photo-1560518883-ce09059eeffa',
    'photo-1486406146926-c627a92ad1ab',
    'photo-1509391366360-2e959784a276',
  ],
  // Halls, stages and delegates — events and exhibitions
  event: [
    'photo-1531973576160-7125cd663d86',
    'photo-1540575467063-178a50c2df87',
    'photo-1505373877841-8d25f7d46678',
    'photo-1523482580672-f109ba8cb9be',
  ],
  // Workspaces — documents, reports, brand kits
  work: [
    'photo-1497366754035-f200968a6e72',
    'photo-1493246507139-91e8fad9978e',
  ],
};

/** Stable hash so the same key always resolves to the same photograph. */
function hash(key) {
  let h = 0;
  const s = String(key || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * A themed photograph URL for a record.
 * @param pool  which themed set to draw from
 * @param key   the record id — same key, same image, always
 * @param w     requested width; Unsplash resizes at the CDN
 */
export function photo(pool, key, w = 600) {
  const set = POOLS[pool] || POOLS.city;
  const id = set[hash(key) % set.length];
  return `${CDN}${id}?auto=format&fit=crop&w=${w}&q=70`;
}

/** Asset-type → the pool that best illustrates it. */
export function assetPhoto(asset, w = 480) {
  const pool = asset.type === 'image' ? 'property'
    : asset.type === 'video' ? 'city'
    : asset.type === 'brand-kit' ? 'city'
    : 'work';
  return photo(pool, asset.asset_id || asset.title, w);
}

/** Campaign format → pool. Exhibitions read as halls, campaigns as cityscape. */
export function campaignPhoto(campaign, w = 600) {
  const pool = campaign.type === 'exhibition' ? 'event' : 'city';
  return photo(pool, campaign.campaign_id || campaign.title, w);
}

export function eventPhoto(event, w = 600) {
  return photo('event', event.event_id || event.title, w);
}
