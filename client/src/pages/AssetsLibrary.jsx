import React, { useMemo, useState } from 'react';
import { useApi, postApi, fmt } from '../services/api';
import { Loading, ErrorState, Empty } from '../components/States';
import { useI18n } from '../i18n';
import { useSearch } from '../App';
import { assetPhoto } from '../services/media';
import KPICard from '../components/KPICard';
import {
  assetIcon, IcoDownload, IcoLock, IcoFolder, IcoTrendUp, IcoGlobe, IcoPackage,
} from '../components/icons';

const TYPE_LABEL = {
  image: 'Imagery', video: 'Video', document: 'Documents',
  report: 'Reports', 'brand-kit': 'Brand kits',
};
const TYPE_BG = {
  image:       'linear-gradient(135deg, #0b5fa5, #2e7d80)',
  video:       'linear-gradient(135deg, #084a82, #0b5fa5)',
  document:    'linear-gradient(135deg, #2e7d80, #1f5f62)',
  report:      'linear-gradient(135deg, #1f5f62, #0b5fa5)',
  'brand-kit': 'linear-gradient(135deg, #b08a4f, #8a6636)',
};
// Thumb heights vary by type so the masonry grid has genuine rhythm.
const TYPE_H = { image: 132, video: 116, 'brand-kit': 100, report: 86, document: 78 };

/**
 * Content and Digital Assets Library.
 * A visual masonry grid with a filter sidebar — by type, campaign, or format.
 * Partners only see assets open to all partners plus those for campaigns they
 * were approved on; the DLD portal sees the full catalogue.
 */
export default function AssetsLibrary({ portal }) {
  const { data, error, reload } = useApi('/assets');
  const { t } = useI18n();
  const { q } = useSearch();
  const [type, setType] = useState('all');
  const [campaign, setCampaign] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const assets = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.assets.filter((a) =>
      (type === 'all' || a.type === type) &&
      (campaign === 'all' || a.campaign_title === campaign) &&
      (!term || a.title.toLowerCase().includes(term) || a.campaign_title.toLowerCase().includes(term)));
  }, [data, q, type, campaign]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label={t('Loading asset library…')} />;

  async function download(a) {
    setBusyId(a.asset_id);
    try { await postApi(`/assets/${a.asset_id}/download`, {}); reload(); }
    finally { setBusyId(null); }
  }

  const counts = data.facets.types.reduce((m, t) => {
    m[t] = data.assets.filter((a) => a.type === t).length;
    return m;
  }, {});

  const lib = {
    total: data.assets.length,
    downloads: data.assets.reduce((s, a) => s + (+a.downloads || 0), 0),
    sizeMb: data.assets.reduce((s, a) => s + (+a.size_mb || 0), 0),
    restricted: data.assets.filter((a) => a.access === 'approved_only').length,
    bilingual: data.assets.filter((a) => a.language === 'EN/AR').length,
    mostDownloaded: [...data.assets].sort((a, b) => (+b.downloads || 0) - (+a.downloads || 0))[0],
  };

  return (
    <>
      {/* ── Library metrics: utilisation is the KPI the brief names here ── */}
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <KPICard label={t('Assets Available')} value={fmt.int(lib.total)} icon={<IcoFolder size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{data.facets.types.length}</strong> categories · {(lib.sizeMb / 1024).toFixed(1)} GB total</>} />
        <KPICard label={t('Total Downloads')} value={fmt.compact(lib.downloads)} tone="teal" icon={<IcoDownload size={17} />}
          foot="Asset utilisation across all partners" />
        <KPICard label={t('Avg. Downloads Per Asset')} value={fmt.int(Math.round(lib.downloads / Math.max(1, lib.total)))}
          tone="teal" icon={<IcoTrendUp size={17} />}
          foot="How hard the library is actually working" />
        <KPICard label={t('Bilingual Assets')} value={fmt.int(lib.bilingual)} icon={<IcoGlobe size={17} />}
          foot={<>{fmt.pct((lib.bilingual / Math.max(1, lib.total)) * 100, 0)} available in EN and AR</>} />
        <KPICard label={t('Restricted Assets')} value={fmt.int(lib.restricted)} tone="sand" icon={<IcoLock size={17} />}
          foot="Limited to approved campaign participants" />
        <KPICard label={t('Most Downloaded')} value={fmt.int(lib.mostDownloaded?.downloads || 0)} tone="sand" icon={<IcoPackage size={17} />}
          foot={lib.mostDownloaded?.title || '—'} />
      </div>

    <div style={{ display: 'grid', gridTemplateColumns: '218px 1fr', gap: 18, alignItems: 'start' }}>
      {/* ── Filter sidebar ── */}
      <aside className="card" style={{ padding: '14px 14px 16px', position: 'sticky', top: 0 }}>
        <div className="panel-title" style={{ marginBottom: 10 }}>Asset type</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 18 }}>
          <FilterRow label={t('All assets')} count={data.assets.length} on={type === 'all'} onClick={() => setType('all')} />
          {data.facets.types.map((t) => (
            <FilterRow key={t} label={TYPE_LABEL[t] || t} count={counts[t]} on={type === t} onClick={() => setType(t)} />
          ))}
        </div>

        <div className="panel-title" style={{ marginBottom: 8 }}>Campaign</div>
        <select className="field-input" value={campaign} onChange={(e) => setCampaign(e.target.value)}
          style={{ height: 34, fontSize: 12, cursor: 'pointer' }}>
          <option value="all">All campaigns</option>
          {data.facets.campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <div style={{
          marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--app-border)',
          fontSize: 10.5, color: 'var(--app-text-faint)', lineHeight: 1.6,
        }}>
          {portal === 'developer'
            ? 'You see assets open to all partners, plus material for campaigns you were approved on.'
            : 'Full catalogue — every asset published across all programmes.'}
        </div>
      </aside>

      {/* ── Gallery ── */}
      <div style={{ minWidth: 0 }}>
        <div className="page-header-block">
          <div>
            <div className="page-title">
              {type === 'all' ? 'All Assets' : TYPE_LABEL[type] || type}
            </div>
            <div className="page-subtitle">
              {assets.length} item{assets.length === 1 ? '' : 's'}
              {campaign !== 'all' ? ` · ${campaign}` : ''}
              {q ? ` · matching “${q}”` : ''}
            </div>
          </div>
        </div>

        {assets.length === 0 ? (
          <div className="card"><Empty>
            <IcoFolder size={26} />
            No assets match the current filters
          </Empty></div>
        ) : (
          <div className="asset-grid">
            {assets.map((a) => {
              const Icon = assetIcon(a.type);
              return (
                <article key={a.asset_id} className="asset-card">
                  {/* Photograph under a brand scrim — the gradient stays as the
                      ground, so a slow or blocked image still reads correctly. */}
                  <div className="asset-thumb" style={{
                    background: TYPE_BG[a.type] || TYPE_BG.document,
                    height: TYPE_H[a.type] || 90,
                  }}>
                    <img src={assetPhoto(a)} alt="" loading="lazy" className="asset-thumb-img" />
                    <span className="asset-thumb-scrim" />
                    <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}><Icon size={30} /></span>
                    <span style={{
                      position: 'absolute', top: 9, insetInlineEnd: 9,
                      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em',
                      padding: '2px 7px', borderRadius: 20,
                      background: 'rgba(255,255,255,0.22)', color: '#fff',
                      border: '1px solid rgba(255,255,255,0.30)',
                    }}>{a.file_type}</span>
                    {a.access === 'approved_only' && (
                      <span title="Restricted to approved participants" style={{
                        position: 'absolute', top: 9, insetInlineStart: 9,
                        display: 'flex', alignItems: 'center', gap: 3,
                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                        background: 'rgba(0,0,0,0.28)', color: '#fff',
                      }}><IcoLock size={9} sw={2.4} />RESTRICTED</span>
                    )}
                  </div>

                  <div style={{ padding: '12px 13px 13px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--app-text)', lineHeight: 1.35 }}>{a.title}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 5, lineHeight: 1.45 }}>
                      {a.campaign_title}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 8, marginTop: 11, paddingTop: 9, borderTop: '1px solid var(--app-border-soft)',
                    }}>
                      <span className="ltr-num" style={{ fontSize: 10, color: 'var(--app-text-faint)' }}>
                        {a.size_mb} MB · {a.language} · {fmt.int(a.downloads)} downloads
                      </span>
                      <button className="btn btn-ghost btn-sm" disabled={busyId === a.asset_id}
                        onClick={() => download(a)} title="Download">
                        <IcoDownload size={11} sw={2.2} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function FilterRow({ label, count, on, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
        width: '100%', textAlign: 'left', transition: 'all 0.13s ease',
        background: on ? 'var(--app-accent)' : 'transparent',
        border: '1px solid transparent',
        color: on ? '#fff' : 'var(--app-text-muted)',
        fontSize: 12, fontWeight: on ? 650 : 500,
      }}>
      <span>{label}</span>
      <span className="ltr-num" style={{ fontSize: 10.5, opacity: on ? 0.85 : 0.6 }}>{count}</span>
    </button>
  );
}
