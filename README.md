# BML People Analytics Platform

## Purpose
A secure internal People Analytics platform that turns monthly HR source datasets into validated metrics, comparative analytics, forecasts, HR-reviewed insights, and persistent division-specific dashboards.

## Product flow
1. Create reporting period.
2. Upload source datasets.
3. Map and validate records.
4. Resolve blocking data-quality issues.
5. Approve source snapshots.
6. Calculate deterministic KPIs.
7. Compare MoM / QoQ / YoY / YTD / organisational benchmarks.
8. Run eligible back-tested forecasts.
9. Generate AI-assisted insights and recommendations.
10. HR reviews, edits and approves.
11. Publish a versioned reporting snapshot.
12. Authorised users access BML or division dashboards through SSO.

## Core modules
- HR Command Centre
- Data Upload Centre
- Data Quality
- Metric & Comparison Engine
- Predictive Analytics
- AI Insights & Recommendations
- BML Dashboard
- Division Dashboards
- Ask People Analytics
- Reports / Exports
- Admin / Access / Audit

## Suggested stack
Production stack is subject to BML IT and Information Security approval.
- Web: Next.js / React
- API: ASP.NET Core or Node/NestJS
- Database: Azure SQL or PostgreSQL
- Files: Azure Blob / approved document storage
- Identity: Microsoft Entra ID
- Background jobs: Azure Functions / worker queue
- AI: approved enterprise/Azure OpenAI endpoint
- Monitoring: approved Azure/internal observability
- Optional analytics visualisation: Power BI Embedded

A Power Platform alternative (Power Apps + Dataverse + Power Automate + Power BI) can be evaluated during architecture review.

## Repository structure
```text
apps/
  web/
  api/
  worker/
packages/
  ui/
  metrics/
  schemas/
  auth/
  ai/
infra/
docs/
tests/
sample-data/
```

## Data principles
- UID is the primary employee join key.
- Organisational hierarchy is effective-dated.
- Raw uploads are versioned and retained according to policy.
- Published results are reproducible from approved source versions.
- Metric definitions are versioned configuration.
- Corrections create new versions; do not silently overwrite published history.
- Production data must not be used in development unless masked and approved.

## Security
- SSO + MFA according to Bank policy.
- Server-side role and organisational-scope enforcement.
- Least privilege.
- Restricted ER data separated from broad analytics access.
- Audit uploads, overrides, approvals, publication, exports and access changes.
- No public secret-link dashboards.
- Use only Bank-approved hosting and AI/data-processing services.

## AI rules
AI can summarise calculated evidence, identify patterns, draft recommendations and answer governed analytics questions. It does not own authoritative KPI calculation and must not make autonomous high-impact employment or disciplinary decisions. HR approves publishable insights.

## Forecast rules
Forecasts are enabled only where history is sufficient and back-testing supports usefulness. Display confidence/interval, model version and historical error. If evidence is insufficient, return `insufficient_history`.

## Environments
- DEV: synthetic data
- UAT: approved test/masked data
- PROD: live controlled data

## Local development

```bash
npm install
npm run dev
```

The People Analytics dashboard runs at `http://127.0.0.1:3000` and the development API at `http://127.0.0.1:3001`.

## Development sequence
Phase 0: discovery, metric dictionary, security and architecture.
Phase 1: ingestion + validation MVP.
Phase 2: core workforce/attendance/OT dashboards.
Phase 3: full reporting domains + publishing.
Phase 4: comparative analytics + AI insights.
Phase 5: predictive analytics.
Phase 6: Ask People Analytics.
Phase 7: upstream integrations and optimisation.

## Definition of done
A feature is complete only when:
- business rule is documented,
- permissions are enforced server-side,
- unit/integration tests pass,
- audit requirements are met,
- HR UAT confirms calculations,
- errors are understandable,
- documentation is updated,
- no sensitive data is exposed in logs.

## First implementation task
Do not start with dashboard styling. Start by collecting the actual raw monthly files and producing:
1. Data inventory
2. Field-level data dictionary
3. Metric dictionary
4. Organisational hierarchy rules
5. Validation rules
6. Access matrix
7. Golden test dataset

These become the contract for the application.

---
## Current implementation status
- Contract docs: `docs/` (data-inventory, data-dictionary, metric-dictionary, org-hierarchy-rules, validation-rules, access-matrix, golden-dataset, open-questions) and `ASSUMPTIONS.md`. Four are generated from code: `npm run docs`.
- Tests (Node 22+, no dependencies): `npm test`.
- Dev API: in-memory repository with mock authentication for local development.
- Web: responsive People Analytics command centre, reporting-period workflow, upload and validation screens, aggregate export, and audit trail.
- Implemented dashboard domains: workforce headcount, attendance/leave utilisation, and overtime metrics using approved source snapshots.
- Verified locally: production web build and the complete automated test suite.
- **UNVERIFIED infrastructure:** `infra/migrations/*.sql`, `infra/docker-compose.yml`, `apps/api/src/nest/*`, and `apps/api/src/postgres-repository.ts`.
- **PENDING HR SIGN-OFF:** every metric definition, threshold and band. HR UAT is not done.
