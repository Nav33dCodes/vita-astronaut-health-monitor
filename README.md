# AstroHealth: astronaut health monitoring

Built for the NASA Space Apps 2026 challenge **"Create Health Monitoring Software for Astronauts on Space Missions"** (Intermediate).

Flight surgeons record crew vitals. A rule engine checks each reading against NASA-style safe ranges and raises **warning** or **critical** alerts. The dashboard shows the health of every crew member at a glance.

| Layer    | Stack |
|----------|-------|
| API      | .NET 10, ASP.NET Core Minimal APIs, EF Core 10 (SQLite), FluentValidation, OpenAPI + Scalar |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query, React Hook Form + Zod, Recharts |
| Tests    | xUnit: domain unit tests and API integration tests (`WebApplicationFactory`) |

## Run it

```bash
# 1. API → http://localhost:5080  (API docs: http://localhost:5080/scalar)
cd backend
dotnet run --project src/AstroHealth.Api

# 2. Frontend → http://localhost:3000
cd frontend
npm install
npm run dev
```

In Development, the API applies the EF Core migrations on startup. It also seeds 3 missions, 8 astronauts and 3 days of vitals, including a few built-in medical scenarios. To start over, delete `backend/src/AstroHealth.Api/astrohealth.db`.

```bash
cd backend && dotnet test      # 23 tests
```

## Database (Neon PostgreSQL)

Production uses **PostgreSQL on Neon**. Development falls back to a local SQLite file, so the project runs right after cloning.

```bash
# Point local development at Neon. Secrets stay in your user profile, never in git.
cd backend
dotnet user-secrets set "Database:Provider" "Postgres" --project src/AstroHealth.Api
dotnet user-secrets set "ConnectionStrings:Default" "postgresql://...neon.tech/neondb?sslmode=require" --project src/AstroHealth.Api
```

Production uses environment variables: `ConnectionStrings__Default` and `Database__Provider=Postgres`.

- **Pooled and direct connections:** the app uses Neon's pooled endpoint (`-pooler`). Migrations automatically switch to the direct endpoint, because PgBouncer can't hold the migration lock. An optional `ConnectionStrings:Migrations` setting overrides this.
- **Connection strings:** Neon `postgresql://` URLs are accepted as-is. TLS is enforced, and cold starts are covered by connection retries.
- **Retention:** raw readings are kept for 7 days. After that they are rolled into hourly `VitalRollups` (kept 730 days), so storage stays bounded and long-range charts still work. Configure it under `Retention`.
- **Migrations** apply automatically on startup. To add one: `dotnet ef migrations add <Name> -p src/AstroHealth.Infrastructure -s src/AstroHealth.Infrastructure -o Persistence/Migrations`

## Architecture (backend)

```
src/
  AstroHealth.Domain          Entities, enums, Result/Error, HealthEvaluator rule engine (no dependencies)
  AstroHealth.Application     Use-case services, request/response contracts, validators, IAppDbContext
  AstroHealth.Infrastructure  EF Core DbContext, configurations, migrations, seeding, health checks
  AstroHealth.Api             Minimal API endpoints, validation filter, ProblemDetails, CORS, rate limiting
tests/AstroHealth.Tests       Domain unit tests and HTTP integration tests
```

Key design decisions:
- **Result pattern** instead of exceptions for expected failures. Each `Error` maps to an RFC 9457 ProblemDetails response (`404`, `409`, `400`) with a machine-readable `code`.
- **Rich domain model**: alert lifecycle rules (`Open → Acknowledged → Resolved`) live in `HealthAlert`, and invalid transitions return `409`.
- **Alert de-duplication with escalation**: a repeated warning for the same metric is suppressed, but warning → critical always raises a new alert.
- **Derived health status** (`Nominal / Caution / Critical / Unknown`) is computed from unresolved alerts, and status filtering runs in the database.
- Readings that are physically impossible (sensor faults) are rejected by validation. Readings that are only unhealthy are accepted and raise alerts.

## API overview (`/api/v1`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/dashboard/summary` | Fleet-wide health overview |
| GET/POST | `/missions` | List / create missions |
| GET/PUT/DELETE | `/missions/{id}` | Read / update / delete (409 if crew assigned) |
| PATCH | `/missions/{id}/status` | Change mission status |
| GET/POST | `/astronauts` | Search (search, missionId, status, paging) / create |
| GET/PUT/DELETE | `/astronauts/{id}` | Detail with latest reading / update / delete |
| GET/POST | `/astronauts/{id}/vitals` | History (from, to, paging) / record a reading (returns any alerts it raised) |
| GET | `/astronauts/{id}/vitals/stats?hours=24` | Min/max/avg per metric |
| GET | `/vitals/thresholds` | Safe ranges per metric |
| GET | `/alerts` | Filter by status, severity, astronaut |
| POST | `/alerts/{id}/acknowledge` · `/alerts/{id}/resolve` | Alert lifecycle |
| GET | `/health/live` · `/health/ready` | Liveness / readiness probes |

## Real-time monitoring (SignalR)

```
Telemetry Simulator ──► VitalService ──► DB + HealthEvaluator ──► ITelemetryPublisher
 (BackgroundService)                                                    │
                                                         SignalR hub /hubs/telemetry
                                                                        │
                       Next.js RealtimeProvider ◄───────────────────────┘
                       ├─ live buffers   → Live Monitor tiles, sparklines
                       ├─ event store    → Event Log, Overview feed, throughput chart
                       ├─ query cache    → coalesced invalidations (no refetch storms)
                       └─ toasts + chime → AlertRaised (critical)
```

- **Hub events:** `ReadingRecorded`, `AlertRaised`, `AlertUpdated`. The client calls `Ping()` to measure latency.
- **Simulator:** in Development it streams vitals every 5 s for crew on *active* missions, with occasional episodes (tachycardia, hypoxia, fever, hypertension, solar particle event). Configure it under `Simulator` in `appsettings.Development.json`.
- **Charts** use `GET /astronauts/{id}/vitals/series?hours&buckets`. The data is downsampled on the server, so chart speed does not depend on how dense the telemetry is.
- **Resilience:** the client reconnects automatically and refetches after a reconnect. While the hub is down, the client falls back to 15 s polling.

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/astronauts/{id}/vitals/series` | Downsampled chart series |
| GET | `/system/status` | Version, uptime, live clients, simulator |
| WS | `/hubs/telemetry` | SignalR telemetry stream |

## Smart monitoring

- **Escalation engine:** an open critical alert with no acknowledgement within 2 min escalates to level 1. Warnings escalate after 15 min. Every further 5 min adds a level, up to 3. Each escalation sends `AlertEscalated` over SignalR, which shows a full-screen master alarm, plays an alarm tone and sends a desktop notification. Configure it under `Escalation`.
- **Early Warning Score:** the NEWS2 score, adapted for our sensors (RR, SpO₂, systolic BP, HR, temperature; max 15). Every reading carries `earlyWarningScore` and `earlyWarningRisk`.
- **Trend detection:** a least-squares fit over the last 60 min. It reports only *deterioration* (movement away from normal, with R² ≥ 0.5) and projects the time until a safe limit is crossed. Endpoints: `GET /assessments` (fleet) and `GET /astronauts/{id}/assessment`.
- **Desktop notifications:** native browser notifications for critical alerts and escalations, switched on from the bell icon in the top bar.
- The simulator also produces gradual 30–60 min episodes (developing fever, dehydration, respiratory decline), so trends can be demonstrated.

## Roadmap ideas
- Real-time updates with SignalR (live vitals stream instead of 15 s polling)
- Authentication and roles (flight surgeon, commander, crew) with JWT
- Wearable/sensor ingestion endpoint and a simulator background service
- Trend-based anomaly detection (for example a rising heart rate over 6 h), on top of fixed thresholds
- Cumulative mission radiation budget per astronaut
- PostgreSQL + Docker Compose, CI pipeline
