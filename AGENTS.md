## Build & Run

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm run test`
- E2E tests: `npm run test:e2e`

## Validation

Run these after implementing to get immediate feedback:
- Tests: `npm run test`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`

## Operational Notes

- Next.js 16 with App Router in src/app/
- TypeScript strict mode enabled with additional strict options
- Supabase for database (migrations in supabase/migrations/)
- Tailwind CSS for styling

### Codebase Patterns

- Database types defined in src/types/database.ts
- API error handling in src/lib/api/errors.ts
- Validation schemas in src/lib/api/validation.ts using Zod
- Supabase clients in src/lib/supabase/ (client.ts for browser, server.ts for SSR)
- Utility functions in src/lib/utils/
