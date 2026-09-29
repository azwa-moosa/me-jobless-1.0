# NestJS adapters — UNVERIFIED

`PlatformService` (../service.ts) is framework-agnostic and is what the tests exercise. The files here are thin NestJS wrappers
that have **not been compiled or run** (no network to install @nestjs/*). They must call the same service so authorisation stays
in one place. Each controller method must: (1) resolve the user via `AuthProvider` in a Guard, (2) call a `PlatformService`
method, (3) map `ForbiddenError` -> 403 and `WorkflowError` -> status per `http.ts` `STATUS`.
