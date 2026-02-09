# AION 2 Dashboard

Local desktop dashboard for AION 2 multi-character progress, energy recovery tracking, and gold estimation.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Project Structure

- `src/main`: Electron main process + IPC registration
- `src/preload`: secure bridge APIs
- `src/renderer`: React UI
- `src/shared`: business models, refresh rules, and estimators
- `FRAMEWORK.md`: baseline architecture and next-step plan

