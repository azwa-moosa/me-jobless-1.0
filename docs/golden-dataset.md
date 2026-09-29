# Golden Dataset

Location: `sample-data/golden/`. **Synthetic only** ("Test Person NN"). Period 2026-09, cut-off 2026-09-30, working days 22 (30 days minus 8 Fri/Sat; public holidays not modelled, A-11). Expected values are hand-derived and stored in `sample-data/golden/expected/`. They are **test fixtures, not BML figures**, and formulas remain PENDING HR SIGN-OFF.

| File | Purpose | Expected |
|---|---|---|
| org_units.csv | Hierarchy incl. one retired department | validates clean |
| staff.csv | 9 employees (1 resigned in period, 1 contract joiner) | 0 issues |
| staff_errors.csv | 10 rows with deliberate errors | expected/staff_errors.issues.json |
| attendance.csv / attendance_errors.csv | clean / unknown UID, duplicate key, negative days, wrong period, bad leave type, impossible days | 0 issues / attendance_errors.issues.json |
| overtime.csv (+ .control.json) | clean, reconciles to control total | 0 issues |
| overtime_errors.csv | duplicate UID-period, negative OT, unknown UID, org mismatch, non-numeric, bad period, outlier | overtime_errors.issues.json |
| overtime_bad_control.control.json | control total cost 7000 vs actual 7425 | overtime_bad_control.issues.json |

## Hand-verified metric results (expected/metrics.json)
- Headcount at cut-off: 8 (Credit 4, Finance 4); U008 resigned 2026-09-15 excluded. Excluding contract: 7.
- OT: hours 148.5, cost 7,425.00; Credit 77.5 h / 3,875; Finance 71 h / 3,550. Per headcount: 18.5625 h, 928.125. Bands (LOW <20, MEDIUM 20-<40, HIGH >=40): 3 / 1 / 2.
- Absence (SICK+UNPLANNED, headcount only): 6 days / (8 x 22 = 176) = 0.0340909.
- Annual leave utilisation: 7 / 90 = 0.0777778.

Tests: `tests/golden-validation.test.ts`, `tests/metrics.test.ts`. Any change to a golden file or expected value requires HR review.
