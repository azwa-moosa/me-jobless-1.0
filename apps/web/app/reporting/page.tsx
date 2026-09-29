'use client';

import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Periods() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const load = async () => { const r = await api<any>('/reporting-periods'); r.status === 200 ? setRows(r.data) : setMsg(r.data.message); };
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const period = new FormData(e.currentTarget).get('period');
    const r = await api<any>('/reporting-periods', { method: 'POST', body: JSON.stringify({ period }) });
    setMsg(r.status === 201 ? 'Reporting period created.' : r.data.message);
    load();
  }

  return (
    <main className="page-shell">
      <div className="page-heading">
        <div><p className="eyebrow">Data management</p><h1>Reporting periods</h1><p className="page-description">Create a monthly reporting cycle and track each dataset through validation and approval.</p></div>
      </div>
      <section className="panel" aria-labelledby="new-period-title">
        <div className="panel-header"><h2 id="new-period-title">Create reporting period</h2></div>
        <div className="panel-body">
          <form className="create-form" onSubmit={create}>
            <div className="field field-grow"><label htmlFor="period">Reporting month</label><input id="period" name="period" type="month" pattern="\d{4}-\d{2}" required /></div>
            <button type="submit">Create period</button>
          </form>
          <p className="status-message" role="status" aria-live="polite">{msg}</p>
        </div>
      </section>
      <section className="panel table-panel" aria-labelledby="periods-title">
        <div className="panel-header"><h2 id="periods-title">Reporting period register</h2><span className="status-chip">{rows.length} total</span></div>
        <div className="table-scroll">
          <table><caption>Periods and dataset status</caption><thead><tr><th scope="col">Period</th><th scope="col">Status</th><th scope="col">Staff</th><th scope="col">Attendance</th><th scope="col">Overtime</th><th scope="col">Action</th></tr></thead>
            <tbody>{rows.map((p) => <tr key={p.id}><th scope="row">{p.period}</th><td><span className="status-chip" data-status={p.status}>{p.status}</span></td>{p.datasets.map((d: any) => <td key={d.dataset}><span className="status-chip" data-status={d.status}>{d.status}</span>{d.batchId ? <> <a href={`/batches/${d.batchId}`}>Review</a></> : null}</td>)}<td><a href={`/upload?period=${p.id}`}>Upload data</a></td></tr>)}</tbody>
          </table>
          {rows.length === 0 ? <div className="empty-state">No reporting periods have been created yet.</div> : null}
        </div>
      </section>
    </main>
  );
}
