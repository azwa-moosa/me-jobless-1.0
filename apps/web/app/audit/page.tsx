'use client';

import { useEffect, useState } from 'react';
import { api } from '../api';

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [message, setMessage] = useState('Loading audit trail...');
  useEffect(() => { api<any>('/audit').then((r) => { if (r.status === 200) { setEvents([...r.data].reverse()); setMessage(''); } else setMessage(r.data.message); }); }, []);
  return (
    <main className="page-shell">
      <div className="page-heading"><div><p className="eyebrow">Governance</p><h1>Audit trail</h1><p className="page-description">Tamper-evident operational events for uploads, approvals, resolutions and reporting periods.</p></div></div>
      {message ? <div className="notice-bar" role="status">{message}</div> : null}
      <section className="panel table-panel" aria-labelledby="audit-title">
        <div className="panel-header"><h2 id="audit-title">Recent activity</h2><span className="status-chip">{events.length} events</span></div>
        <div className="table-scroll"><table><caption>Audit events</caption><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Role</th><th>Period</th><th>Outcome</th></tr></thead>
          <tbody>{events.map((event) => <tr key={event.id}><td>{new Date(event.at).toLocaleString()}</td><td><span className="issue-code">{event.action}</span></td><td>{event.actorId}</td><td>{event.actorRole.replaceAll('_', ' ')}</td><td>{event.periodId ?? '-'}</td><td>{event.details?.outcome ?? event.details?.dataset ?? 'Recorded'}</td></tr>)}</tbody></table>
          {events.length === 0 && !message ? <div className="empty-state">No audit events have been recorded.</div> : null}
        </div>
      </section>
    </main>
  );
}
