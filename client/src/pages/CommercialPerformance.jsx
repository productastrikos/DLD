import React from 'react';
import { Link } from 'react-router-dom';
import { useApi, fmt } from '../services/api';
import { Loading, ErrorState } from '../components/States';
import KPICard from '../components/KPICard';
import Ring from '../components/Ring';
import { BarsChart, ChartPanel, ShareBars } from '../components/charts';
import { useKpi } from '../App';
import { useI18n } from '../i18n';
import {
  IcoDollar, IcoShield, IcoAlert, IcoHandshake, IcoTicket, IcoTrendUp,
  IcoBuilding, IcoCrane, IcoChevron,
} from '../components/icons';

/**
 * Commercial Performance.
 *
 * Contracted value, whether it was delivered, whether it was collected, and
 * what the events programme returned against its budget. These sat on the
 * executive dashboard where they competed with adoption metrics for attention;
 * here they read together as one commercial story, which is how a finance
 * conversation actually runs.
 */
export default function CommercialPerformance() {
  const { data, error } = useApi('/dld/dashboard');
  const { data: ledger } = useApi('/dld/sponsorships');
  const { data: events } = useApi('/events');
  const { openKpi } = useKpi();
  const { t } = useI18n();

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label="Loading commercial performance…" />;

  const k = data.kpis;

  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <KPICard kpiId="commitmentDelivery" onClick={() => openKpi('commitmentDelivery')}
          label={t('Commitment Delivery')} value={fmt.pct(k.commitmentDelivery)} tone="sand" icon={<IcoShield size={17} />}
          foot={t('Contracted deliverables actually met')} />
        <KPICard kpiId="collectionRate" onClick={() => openKpi('collectionRate')}
          label={t('Invoice Collection')} value={fmt.pct(k.collectionRate)} tone="sand" icon={<IcoDollar size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{fmt.aed(k.outstandingValue)}</strong> {t('outstanding')}</>} />
        <KPICard kpiId="blendedRoi" onClick={() => openKpi('blendedRoi')}
          label={t('Agreements Flagged')} value={fmt.int(k.flaggedAgreements)} tone="sand" icon={<IcoAlert size={17} />}
          foot={t('Tripping at least one anomaly rule')} />
        <KPICard kpiId="eventFootfall" onClick={() => openKpi('eventFootfall')}
          label={t('Event Footfall')} value={fmt.compact(k.eventFootfall)} tone="teal" icon={<IcoTicket size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{k.eventsDelivered}</strong> {t('delivered')} · {k.eventsUpcoming} {t('ahead')}</>} />
        <KPICard kpiId="mediaRoi" onClick={() => openKpi('mediaRoi')}
          label={t('Event Media ROI')} value={fmt.pct(k.mediaRoi)} tone="teal" icon={<IcoTrendUp size={17} />}
          foot={<>{t('Earned media')} <strong style={{ color: 'var(--app-text-muted)' }}>{fmt.aed(k.mediaValue)}</strong></>} />
        <KPICard kpiId="portfolioValue" onClick={() => openKpi('portfolioValue')}
          label={t('Delivery Pipeline')} value={fmt.int(k.underConstruction)} unit={t('projects')} icon={<IcoCrane size={17} />}
          foot={<>{t('Under construction across')} <strong style={{ color: 'var(--app-text-muted)' }}>{k.districts}</strong> {t('districts')}</>} />
      </div>

      {/* Delivery and collection, side by side — the two halves of "was it honoured" */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="card card-pad" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Ring value={k.commitmentDelivery} size={118} stroke={10} label={t('Delivered')} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="panel-title">{t('Commitment delivery')}</div>
            <div style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.6, marginTop: 6 }}>
              {t('Contracted value only becomes realised value once the commitments behind it are met. This is the measure that separates a signed agreement from a delivered one.')}
            </div>
            <Link to="/dld/sponsorships" className="btn btn-ghost btn-sm" style={{ marginTop: 10, textDecoration: 'none' }}>
              {t('Open the ledger')} <IcoChevron size={11} />
            </Link>
          </div>
        </div>

        <div className="card card-pad" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Ring value={k.collectionRate} size={118} stroke={10} label={t('Collected')} tone="sand" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="panel-title">{t('Invoice collection')}</div>
            <div style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.6, marginTop: 6 }}>
              {t('Contracted value that has not been invoiced is not yet revenue. Much of the balance is scheduled against milestones not yet due, which is why this reads alongside delivery rather than alone.')}
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--app-text-faint)' }} className="ltr-num">
              {fmt.aed(k.outstandingValue)} {t('outstanding of')} {fmt.aed(k.sponsorshipValue)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {ledger && (
          <ChartPanel title={t('Contracted Value by Tier')} note={t('Where sponsorship revenue is concentrated')}>
            <BarsChart
              data={ledger.byTier} xKey="tier" height={200} layout="horizontal" colorByIndex
              series={[{ key: 'value', label: t('Contracted value') }]}
              fmt={(v) => fmt.aed(v)} tickFmt={(v) => fmt.compact(v)}
            />
          </ChartPanel>
        )}
        {ledger && (
          <ChartPanel title={t('Return by Tier')} note={t('Mean measured ROI per sponsorship tier')}>
            <div style={{ paddingTop: 6 }}>
              <ShareBars
                rows={ledger.byTier.map((r) => ({
                  label: r.tier, value: Math.max(0, r.roi),
                  sub: `${r.count} ${t('agreements')} · ${fmt.aed(r.value)}`,
                }))}
                fmt={(v) => fmt.pct(v)}
              />
            </div>
          </ChartPanel>
        )}
      </div>

      {events && (
        <ChartPanel title={t('Event Return Against Budget')} note={t('Earned media value versus committed budget, per delivered event')}>
          <BarsChart
            data={events.events.filter((e) => e.status === 'completed').map((e) => ({
              event: e.title.length > 26 ? `${e.title.slice(0, 25)}…` : e.title,
              budget: e.budget_aed, media: e.media_value_aed,
            }))}
            xKey="event" height={Math.max(220, events.summary.completed * 46)} layout="horizontal" catWidth={190}
            series={[{ key: 'budget', label: t('Budget') }, { key: 'media', label: t('Earned media') }]}
            fmt={(v) => fmt.aed(v)} tickFmt={(v) => fmt.compact(v)}
          />
        </ChartPanel>
      )}
    </>
  );
}
