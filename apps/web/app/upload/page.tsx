'use client';
// UNVERIFIED. Upload centre: choose dataset + CSV, review suggested column mapping, upload.
import { useState } from 'react';
import { api } from '../api';

export default function Upload() {
  const [text, setText] = useState(''); const [dataset, setDataset] = useState('staff');
  const [suggest, setSuggest] = useState<any>(null); const [msg, setMsg] = useState(''); const [batch, setBatch] = useState('');
  const period = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('period') : null;
  async function onFile(f: File | undefined) { if (!f) return; const t = await f.text(); setText(t); const r = await api<any>('/uploads/profile', { method: 'POST', body: JSON.stringify({ dataset, text: t }) }); r.status === 200 ? setSuggest(r.data) : setMsg(r.data.message); }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await api<any>(`/reporting-periods/${period}/uploads`, { method: 'POST', body: JSON.stringify({ dataset, text, filename: 'upload.csv' }) });
    if (r.status === 201 || r.status === 200) { setBatch(r.data.batch.id); setMsg(`Validated: ${r.data.batch.issues.length} issue(s).`); } else setMsg(r.data.message);
  }
  return (
    <main className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Reporting period</p>
          <h1>Upload centre</h1>
          <p className="page-description">Select a dataset and upload its UTF-8 CSV file. Column headers are checked before validation.</p>
        </div>
        <a className="button-link button-secondary" href="/reporting">Back to periods</a>
      </div>

      <section className="panel" aria-labelledby="upload-title">
        <div className="panel-header"><h2 id="upload-title">Dataset upload</h2>{period ? <span className="status-chip">Period selected</span> : <span className="status-chip" data-status="WARNING">No period</span>}</div>
        <div className="panel-body">
          <form className="upload-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="dataset">Dataset</label>
              <select id="dataset" value={dataset} onChange={(e) => setDataset(e.target.value)}><option value="staff">Staff</option><option value="attendance">Attendance</option><option value="overtime">Overtime</option></select>
            </div>
            <div className="field field-grow">
              <label htmlFor="file">CSV file (UTF-8)</label>
              <input id="file" type="file" accept=".csv" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            <button type="submit" disabled={!text || !period}>Upload and validate</button>
          </form>
          <p className="status-message" role="status" aria-live="polite">{msg} {batch && <a href={`/batches/${batch}`}>View validation issues</a>}</p>
        </div>
      </section>

      {suggest && (
        <section className="panel table-panel" aria-labelledby="mapping-title">
          <div className="panel-header"><h2 id="mapping-title">Suggested column mapping</h2><span className="status-chip" data-status="VALIDATED">Profiled</span></div>
          <div className="table-scroll">
            <table><caption>Suggested column mapping</caption>
              <thead><tr><th scope="col">Field</th><th scope="col">Source column</th><th scope="col">Match</th></tr></thead>
              <tbody>{Object.entries(suggest.suggestion.mapping).map(([f, c]) => <tr key={f}><th scope="row">{f}</th><td>{(c as string) ?? 'Not mapped'}</td><td>{suggest.suggestion.matchedBy[f] ?? '-'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>)}
    </main>
  );
}
