# SV2 UI

A React dashboard for monitoring DMND mining accounts, workers, payouts, generated BTC, subaccounts, and read-only Watcher links.

The repository contains the frontend only. It calls the DMND API directly; there is no bundled application server.

## Development

Requirements:

- Node.js 20
- npm

Install dependencies and start Vite:

```bash
npm ci
npm run dev
```

The application is available at `http://localhost:5173`.

## API configuration

Set `VITE_DMND_API_BASE` to the remote dashboard API origin:

```bash
VITE_DMND_API_BASE=https://dashboard-api.example.com npm run dev
```

When the variable is not defined, the development server defaults to:

```text
https://staging-user-dashboard-server.dmnd.work
```

Each environment's Dockerfile sets its API URL explicitly, matching the existing user-dashboard setup.
For a build outside Docker, set the API URL in the command or a Vite `.env` file:

```bash
VITE_DMND_API_BASE=https://production-user-dashboard-server.dmnd.work npm run build
```

Missing or blank values fail the build. CI explicitly uses staging.

The API must allow the frontend origin and credentialed browser requests because authentication uses an HttpOnly session cookie.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
VITE_DMND_API_BASE=https://dashboard-api.example.com npm run build
```

## Container build

Each Dockerfile builds the Vite application with its fixed API URL and serves the static output with nginx:

| Dockerfile | API URL |
| --- | --- |
| `Dockerfile.prod` | `https://production-user-dashboard-server.dmnd.work` |
| `Dockerfile.staging` | `https://staging-user-dashboard-server.dmnd.work` |

Build the desired environment without passing an API build argument:

```bash
docker build -f Dockerfile.prod -t sv2-ui:production .
docker build -f Dockerfile.staging -t sv2-ui:staging .

docker run --rm -p 8080:80 sv2-ui:staging
```

Open `http://localhost:8080`.

## Project structure

```text
sv2-ui/
├── src/
│   ├── api/          # Remote DMND API clients and response types
│   ├── auth/         # Session handling and authentication validation
│   ├── components/   # Shared interface components
│   ├── hooks/        # React Query data hooks
│   ├── lib/          # Data transformation and formatting helpers
│   └── pages/        # Dashboard and authentication pages
└── public/           # Static assets
```

## Technology

- React 18
- TypeScript
- Vite
- TanStack Query
- Tailwind CSS

## License

MIT OR Apache-2.0
