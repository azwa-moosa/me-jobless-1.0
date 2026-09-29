# Worker — scaffold only

Phase 1 validates synchronously inside the API request (files are small, and the engine is pure and deterministic).
The worker package is reserved for queue-driven parsing/validation of large files, calculation and (later) forecasting/publication.
When added, jobs must call the same `packages/schemas` / `packages/metrics` functions so results stay identical (idempotency test in tests/).
