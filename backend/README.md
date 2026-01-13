# Backend (API + scanner)

This folder contains the Bun + Express server that powers Player 0.

## Run

From the repository root:

- Install deps: `bun install --cwd backend`
- Start server: `bun run --cwd backend start`
- Dev/watch: `bun run --cwd backend dev`
- Scan library: `bun run --cwd backend scan`

Server defaults to `http://localhost:3000`.

## Configuration

Edit `backend/config.json`:

- `musicDirectories`: array of folders to scan
- `supportedFormats`: file extensions allowed
- `dataDirectory`: where JSON data is stored
- `host` / `port`: bind address

## API config notes

See `backend/API_CONFIG.md`.
