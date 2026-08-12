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

When the variable is not defined, development and review builds default to:

```text
https://staging-user-dashboard-server.dmnd.work
```

The API must allow the frontend origin and credentialed browser requests because authentication uses an HttpOnly session cookie.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Container build

`Dockerfile.staging` builds the Vite application and serves the static output with nginx. The API URL is a build argument because Vite embeds it in the browser bundle:

```bash
docker build \
  -f Dockerfile.staging \
  --build-arg VITE_DMND_API_BASE=https://dashboard-api.example.com \
  -t sv2-ui:staging .

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
├── public/           # Static assets
└── deployment/       # Pulumi deployment projects
```

## Technology

- React 18
- TypeScript
- Vite
- TanStack Query
- Tailwind CSS

## License

MIT OR Apache-2.0
