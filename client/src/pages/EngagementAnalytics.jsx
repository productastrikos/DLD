import React from 'react';
import { useApi, fmt, statusChip, statusLabel } from '../services/api';
import { Loading, ErrorState } from '../components/States';
import KPICard from '../components/KPICard';
import { TrendChart, BarsChart, ChartPanel, ShareBars } from '../components/charts';
import { useKpi } from '../App';
import { useI18n } from '../i18n';
import {
  IcoAward, IcoClock, IcoCheck, IcoInbox, IcoTarget, IcoTrendUp,
  IcoPeople, IcoActivity, IcoShield,
} from '../components/icons';

/**
 * Engagement Analytics.
 *
 * The executive dashboard answers "how are we doing" in six numbers. This
 * screen answers "why" for the adoption and efficiency half of that question —
 * the measures that were crowding the dashboard now have room to carry their
 * own trend lines beside them, which is what makes them actionable rather than
 * merely present.
 */
export default function EngagementAnalytics() {
  const { data, error } = useApi('/dld/dashboard');
  const { openKpi } = useKpi();
  const { t } = useI18n();

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label="Loading engagement analytics…" />;

  const k = data.kpis;

  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <KPICard kpiId="meanEngagement" onClick={() => openKpi('meanEngagement')}
          label={t('Mean Engagement Score')} value={k.meanEngagement} unit="/ 100" icon={<IcoAward size={17} />}
          foot={<>{t('Across')} <strong style={{ color: 'var(--app-text-muted)' }}>{k.registeredPartners}</strong> {t('registered partners')}</>} />
        <KPICard kpiId="meanEngagement" onClick={() => openKpi('meanEngagement')}
          label={t('Dormant Partners')} value={fmt.int(k.dormantPartners)} tone="sand" icon={<IcoClock size={17} />}
          foot={t('No platform activity for 45 days or more')} />
        <KPICard kpiId="digitalPct" onClick={() => openKpi('digitalPct')}
          label={t('Digitally Completed')} value={fmt.pct(k.digitalPct)} tone="teal"
          icon={<IcoCheck size={17} />} trend={k.digitalTrend}
          foot={t('Share of transactions handled fully on-platform')} />
        <KPICard kpiId="openRequests" onClick={() => openKpi('openRequests')}
          label={t('Open Requests')} value={fmt.int(k.openRequests)} tone="teal" icon={<IcoInbox size={17} />}
          foot={<>{t('SLA compliance')} <strong style={{ color: 'var(--app-text-muted)' }}>{k.slaCompliance}%</strong></>} />
        <KPICard kpiId="leadsGenerated" onClick={() => openKpi('leadsGenerated')}
          label={t('Leads Delivered')} value={fmt.compact(k.leadsGenerated)} icon={<IcoTarget size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{fmt.int(k.mediaMentions)}</strong> {t('media mentions')}</>} />
        <KPICard kpiId="partnerSatisfaction" onClick={() => openKpi('partnerSatisfaction')}
          label={t('Partner Satisfaction')} value={k.partnerSatisfaction} unit="/ 5" icon={<IcoTrendUp size={17} />}
          foot={t('Rolling monthly partner survey')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 14, marginBottom: 14 }}>
        <ChartPanel title={t('Ecosystem Growth')}
          note={t('Registered vs. active partners and live partnerships, month over month')}>
          <TrendChart
            data={data.trend} xKey="month" height={248} area
            series={[
              { key: 'registered', label: t('Registered partners') },
              { key: 'active', label: t('Active partners') },
              { key: 'partnerships', label: t('Active partnerships') },
            ]}
            fmt={(v) => fmt.int(v)}
          />
        </ChartPanel>

        <ChartPanel title={t('Adoption by Developer Tier')} note={t('Where the ecosystem\'s engagement actually sits')}>
          <BarsChart
            data={data.byTier} xKey="tier" height={248} layout="horizontal"
            series={[{ key: 'partners', label: t('Registered') }, { key: 'active', label: t('Active') }]}
            fmt={(v) => fmt.int(v)}
          />
        </ChartPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 14 }}>
        <ChartPanel title={t('Approval Time')} note={t('Average days from submission to decision (lower is better)')}>
          <TrendChart data={data.trend} xKey="month" height={190} unit=" days"
            series={[{ key: 'approvalDays', label: t('Avg. approval days') }]} fmt={(v) => v} />
        </ChartPanel>
        <ChartPanel title={t('Digital Completion')} note={t('Share of partner transactions completed entirely on-platform')}>
          <TrendChart data={data.trend} xKey="month" height={190} unit="%" area
            series={[{ key: 'digitalPct', label: t('Digitally completed') }]} fmt={(v) => v} />
        </ChartPanel>
        <ChartPanel title={t('Request Throughput')} note={t('Submitted vs. approved participation requests per month')}>
          <TrendChart data={data.trend} xKey="month" height={190}
            series={[{ key: 'submitted', label: t('Submitted') }, { key: 'approved', label: t('Approved') }]}
            fmt={(v) => fmt.int(v)} />
        </ChartPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 14 }}>
        <ChartPanel title={t('Engagement by Tier')} note={t('Mean engagement score per developer tier')}>
          <div style={{ paddingTop: 6 }}>
            <ShareBars
              rows={data.byTier.map((r) => ({
                label: r.tier, value: r.avgEngagement,
                sub: `${r.partners} ${t('partners')} · ${r.requests} ${t('requests')}`,
              }))}
              fmt={(v) => `${v} / 100`}
            />
          </div>
        </ChartPanel>

        <ChartPanel title={t('Satisfaction Trend')} note={t('Partner and internal stakeholder survey scores')}>
          <TrendChart data={data.trend} xKey="month" height={220}
            series={[{ key: 'satisfaction', label: t('Partner satisfaction') }]} fmt={(v) => v} />
        </ChartPanel>
      </div>
    </>
  );
}
