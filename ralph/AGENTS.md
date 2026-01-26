## Build & Run (Ralph)

- Install: `npm install` (from ralph/ directory)
- Build: `tsc`
- Start: `node dist/index.js`
- Dev: `tsc --watch`
- Typecheck: `tsc --noEmit`

## Code Conventions

- TypeScript strict mode
- ES modules (type: module)
- Node.js 18+
- Relative imports with .js extensions (ES module requirement)

## Validation

Run these after implementing to get immediate feedback:
- Typecheck: `npm run typecheck` (from project root)
- Build: `npm run build` (from project root)
