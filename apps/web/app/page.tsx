'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

type Period = { id: string; period: string; status: string };
type Metric = { metricId: string; scope: string; dimension: string | null; value: number; numerator: number | null; denominator: number | null };
type Calculation = { period: string; results: Metric[]; inputHash: string; notice: string };

function number(value: number | undefined, digits = 0) {
  if (value === undefined) return '-';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function findMetric(calc: Calculation | undefined, id: string, scope: string, dimension: string | null = null) {
  return calc?.results.find((m) => m.metricId === id && m.scope === scope && m.dimension === dimension);
}

export default function CommandCentre() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [selected, setSelected] = useState('');
  const [scope, setScope] = useState('BANK');
  const [message, setMessage] = useState('Loading analytics...');

  useEffect(() => {
    let active = true;
    (async () => {
      const periodResponse = await api<any>('/reporting-periods');
      if (!active) return;
      if (periodResponse.status !== 200) { setMessage(periodResponse.data.message); return; }
      const ready = (periodResponse.data as Period[]).filter((p) => p.status === 'READY_FOR_CALCULATION');
      setPeriods(ready);
      if (ready.length === 0) { setMessage('No approved reporting period is ready for analytics.'); return; }
      const calculated = await Promise.all(ready.map(async (p) => {
        const r = await api<any>(`/periods/${p.id}/calculate`, { method: 'POST', body: JSON.stringify({ workingDays: 22 }) });
        return r.status === 200 ? { ...r.data, period: p.period } as Calculation : null;
      }));
      if (!active) return;
      const valid = calculated.filter((c): c is Calculation => c !== null);
      setCalculations(valid);
      setSelected(valid.at(-1)?.period ?? '');
      setMessage(valid.length ? '' : 'Metrics could not be calculated for the approved periods.');
    })();
    return () => { active = false; };
  }, []);

  const current = calculations.find((c) => c.period === selected);
  const scopes = useMemo(() => current?.results.filter((m) => m.metricId === 'WF-HEADCOUNT').map((m) => m.scope) ?? ['BANK'], [current]);
  const headcount = findMetric(current, 'WF-HEADCOUNT', scope)?.value;
  const absence = findMetric(current, 'ATT-ABSENCE-RATE', scope)?.value;
  const leave = findMetric(current, 'ATT-MANDATORY-UTIL', scope)?.value;
  const otHours = findMetric(current, 'OT-HOURS', scope)?.value;
  const otCost = findMetric(current, 'OT-COST', scope)?.value;
  const otPerEmployee = findMetric(current, 'OT-HOURS-PER-EMP', scope)?.value;
  const divisionRows = (current?.results ?? []).filter((m) => m.metricId === 'WF-HEADCOUNT' && m.scope.startsWith('DIVISION:'));
  const maxDivisionHeadcount = Math.max(...divisionRows.map((m) => m.value), 1);
  const overtimeBands = (current?.results ?? []).filter((m) => m.metricId === 'OT-BANDS' && m.scope === scope);
  const maxBand = Math.max(...overtimeBands.map((m) => m.value), 1);
  const trend = calculations.map((c) => ({ period: c.period, value: findMetric(c, 'WF-HEADCOUNT', scope)?.value ?? 0 }));
  const maxTrend = Math.max(...trend.map((t) => t.value), 1);
  const topOvertimeDivision = [...(current?.results ?? [])].filter((m) => m.metricId === 'OT-HOURS' && m.scope.startsWith('DIVISION:')).sort((a, b) => b.value - a.value)[0];

  function exportMetrics() {
    if (!current) return;
    const lines = ['period,scope,metric,dimension,value,numerator,denominator', ...current.results.map((m) => [selected, m.scope, m.metricId, m.dimension ?? '', m.value, m.numerator ?? '', m.denominator ?? ''].join(','))];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `people-analytics-${selected}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-shell dashboard-page">
      <div className="page-heading dashboard-heading">
        <div><p className="eyebrow">HR command centre</p><h1>People analytics</h1><p className="page-description">Bank-wide workforce, attendance and overtime performance.</p></div>
        <div className="dashboard-filters">
          <div className="field compact-field"><label htmlFor="scope">Organisation</label><select id="scope" value={scope} onChange={(e) => setScope(e.target.value)}>{scopes.map((s) => <option key={s} value={s}>{s === 'BANK' ? 'Bank of Maldives' : s.replace('DIVISION:', '')}</option>)}</select></div>
          <div className="field compact-field"><label htmlFor="dashboard-period">Period</label><select id="dashboard-period" value={selected} onChange={(e) => setSelected(e.target.value)}>{periods.map((p) => <option key={p.id} value={p.period}>{p.period}</option>)}</select></div>
          <button className="button-secondary export-button" type="button" onClick={exportMetrics} disabled={!current}>Export CSV</button>
        </div>
      </div>

      <nav className="dashboard-tabs" aria-label="Dashboard sections"><a href="#overview">Overview</a><a href="#workforce">Workforce</a><a href="#attendance">Attendance</a><a href="#overtime">Overtime</a><a href="#insights">Insights</a></nav>
      {message ? <div className="notice-bar" role="status">{message} <a href="/reporting">Manage reporting periods</a></div> : null}

      <section id="overview" className="metric-grid" aria-label="Key people metrics">
        <article className="metric-card metric-card-primary"><span className="metric-label">Headcount</span><strong>{number(headcount)}</strong><span className="metric-context">Active employees</span></article>
        <article className="metric-card"><span className="metric-label">Absence rate</span><strong>{absence === undefined ? '-' : `${number(absence * 100, 2)}%`}</strong><span className="metric-context">Available working days</span></article>
        <article className="metric-card"><span className="metric-label">Overtime hours</span><strong>{number(otHours, 1)}</strong><span className="metric-context">{number(otPerEmployee, 1)} per employee</span></article>
        <article className="metric-card"><span className="metric-label">Overtime cost</span><strong><small>MVR</small> {number(otCost, 0)}</strong><span className="metric-context">Approved snapshot</span></article>
      </section>

      <div className="dashboard-grid">
        <section id="workforce" className="panel analytics-panel">
          <div className="panel-header"><div><p className="panel-kicker">Workforce</p><h2>Headcount by division</h2></div><span className="status-chip" data-status="APPROVED">Approved data</span></div>
          <div className="chart-body">{divisionRows.map((row) => <div className="bar-row" key={row.scope}><span>{row.scope.replace('DIVISION:', '')}</span><div className="bar-track"><i style={{ width: `${Math.max(4, row.value / maxDivisionHeadcount * 100)}%` }} /></div><strong>{number(row.value)}</strong></div>)}{divisionRows.length === 0 ? <div className="empty-state compact-empty">No division data available.</div> : null}</div>
        </section>
        <section className="panel analytics-panel">
          <div className="panel-header"><div><p className="panel-kicker">Comparison</p><h2>Headcount trend</h2></div><span className="status-chip">{trend.length} periods</span></div>
          <div className="column-chart" aria-label="Headcount by reporting period">{trend.map((item) => <div className="column-item" key={item.period}><strong>{number(item.value)}</strong><div className="column-track"><i style={{ height: `${Math.max(5, item.value / maxTrend * 100)}%` }} /></div><span>{item.period}</span></div>)}</div>
        </section>
      </div>

      <div className="dashboard-grid">
        <section id="attendance" className="panel analytics-panel">
          <div className="panel-header"><div><p className="panel-kicker">Attendance</p><h2>Leave utilisation</h2></div></div>
          <div className="utilisation-layout"><div className="donut" style={{ '--value': `${Math.min((leave ?? 0) * 100, 100)}%` } as React.CSSProperties}><span><strong>{leave === undefined ? '-' : `${number(leave * 100, 1)}%`}</strong><small>utilised</small></span></div><div className="detail-list"><div><span>Mandatory annual leave</span><strong>{leave === undefined ? '-' : `${number(leave * 100, 1)}%`}</strong></div><div><span>Absence rate</span><strong>{absence === undefined ? '-' : `${number(absence * 100, 2)}%`}</strong></div><div><span>Working days basis</span><strong>22 days</strong></div></div></div>
        </section>
        <section id="overtime" className="panel analytics-panel">
          <div className="panel-header"><div><p className="panel-kicker">Overtime</p><h2>Employee utilisation bands</h2></div></div>
          <div className="chart-body">{overtimeBands.map((row) => <div className="bar-row" key={row.dimension}><span>{row.dimension}</span><div className="bar-track warm"><i style={{ width: `${Math.max(row.value ? 4 : 0, row.value / maxBand * 100)}%` }} /></div><strong>{number(row.value)}</strong></div>)}{overtimeBands.length === 0 ? <div className="empty-state compact-empty">No overtime band data available.</div> : null}</div>
        </section>
      </div>

      <section id="insights" className="panel insight-panel">
        <div className="panel-header"><div><p className="panel-kicker">Evidence-based insights</p><h2>What needs attention</h2></div><span className="status-chip">HR review</span></div>
        <div className="insight-grid"><article><span className="insight-number">01</span><div><strong>Overtime concentration</strong><p>{topOvertimeDivision ? `${topOvertimeDivision.scope.replace('DIVISION:', '')} records the highest division overtime at ${number(topOvertimeDivision.value, 1)} hours.` : 'Overtime concentration will appear when division data is available.'}</p></div></article><article><span className="insight-number">02</span><div><strong>Attendance position</strong><p>{absence === undefined ? 'Attendance metrics are unavailable for this scope.' : `Absence accounts for ${number(absence * 100, 2)}% of available working days in the selected period.`}</p></div></article><article><span className="insight-number">03</span><div><strong>Data confidence</strong><p>All three source snapshots are approved. Metric definitions remain pending HR sign-off.</p></div></article></div>
      </section>
    </main>
  );
}
