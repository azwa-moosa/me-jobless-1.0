# Web (Next.js)

Responsive internal People Analytics interface with a workforce/attendance/overtime command centre, reporting-period management,
CSV upload and validation, aggregate export, and audit trail. The web app calls the API in `apps/api` and relies on it for every
permission decision; hiding a control in the browser is convenience only. Dev auth uses `NEXT_PUBLIC_DEV_USER=u-hr-admin`
(mock provider only). Tables use captions and scoped headers, forms are labelled, status updates use `aria-live`, and controls are
keyboard operable.
