'use client';
// UNVERIFIED. Issue table (row/field detail), resolve/override with reason, approve.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../api';

export default function Batch() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null); const [msg, setMsg] = useState('');
  const load = async () => { const r = await api<any>(`/batches/${params.id}`); r.status === 200 ? setData(r.data) : setMsg(r.data.message); };
  useEffect(() => { load(); }, []);
  async function resolve(issueId: string, needsRef: boolean) {
    const reason = window.prompt('Reason (min 10 characters). Do not enter personal data.'); if (!reason) return;
    const reference = needsRef ? window.prompt('Approval reference (required)') : null;
    const r = await api<any>(`/batches/${params.id}/issues/${encodeURIComponent(issueId)}/resolve`, { method: 'POST', body: JSON.stringify({ reason, reference }) });
    setMsg(r.status === 200 ? 'Resolution recorded and audited.' : r.data.message); load();
  }
  async function approve() { const r = await api<any>(`/batches/${params.id}/approve`, { method: 'POST' }); setMsg(r.status === 200 ? 'Snapshot approved.' : r.data.message); load(); }
  if (!data) return <main className="page-shell"><p className="status-message" role="status">{msg || 'Loading...'}</p></main>;
  const b = data.batch;
  return (
    <main className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Validation review</p>
          <h1>{b.dataset} dataset</h1>
          <p className="page-description">Review validation findings and formally resolve eligible issues before approving this snapshot.</p>
        </div>
        <a className="button-link button-secondary" href="/reporting">Back to periods</a>
      </div>

      <div className="summary-strip" aria-label="Batch summary">
        <div className="summary-item"><span className="summary-label">Version</span><span className="summary-value">{b.version}</span></div>
        <div className="summary-item"><span className="summary-label">Rows</span><span className="summary-value">{b.rowCount}</span></div>
        <div className="summary-item"><span className="summary-label">Status</span><span className="status-chip" data-status={b.status}>{b.status}</span></div>
      </div>

      <div className="batch-actions">
        <p className="status-message" role="status" aria-live="polite">{msg || `${data.unresolvedBlocking} unresolved blocking issue(s).`}</p>
        <button onClick={approve} disabled={b.status !== 'VALIDATED' || data.unresolvedBlocking > 0}>Approve snapshot</button>
      </div>

      <section className="panel table-panel" aria-labelledby="issues-title">
        <div className="panel-header"><h2 id="issues-title">Validation issues</h2><span className="status-chip" data-status={data.unresolvedBlocking > 0 ? 'BLOCKING' : 'READY'}>{b.issues.length} issues</span></div>
        <div className="table-scroll">
          <table className="issue-table">
            <caption>Validation issues</caption>
            <thead><tr><th scope="col">Row</th><th scope="col">Field</th><th scope="col">Severity</th><th scope="col">Code</th><th scope="col">Message</th><th scope="col">Resolution</th></tr></thead>
            <tbody>{b.issues.map((i: any) => (
              <tr key={i.id}><td>{i.row ?? '-'}</td><td>{i.field ?? '-'}</td><td><span className="status-chip" data-status={i.severity}>{i.severity}</span></td><td><span className="issue-code">{i.code}</span></td><td>{i.message}</td>
                <td>{i.resolution ? <span className="resolution">{i.resolution.kind}: {i.resolution.reason}</span> : <button onClick={() => resolve(i.id, i.code === 'UNKNOWN_UID')}>Resolve</button>}</td></tr>))}
            </tbody>
          </table>
          {b.issues.length === 0 ? <div className="empty-state">No validation issues were found.</div> : null}
        </div>
      </section>
    </main>
  );
}
