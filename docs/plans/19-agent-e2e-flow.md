# Plan — 19 Agent E2E Flow

## Tasks

- [ ] 1. Create `e2e/agent-flow.spec.ts` with inline admin authentication
- [ ] 2. Auth block: login with `admin@crypto.com` / `Admin1234!`, verify redirect to `/dashboard`
- [ ] 3. Config block: navigate to `/dashboard/config`, select BTC/USDT/SANDBOX, set sliders, save, verify card appears
- [ ] 4. Start agent block: click config card → AgentDetailModal → Start Agent → verify "Running" badge
- [ ] 5. Agent log block: navigate to `/dashboard/agent`, verify heading and content (decisions or empty state)
- [ ] 6. Positions block: navigate to `/dashboard/positions`, verify heading and table/empty state
- [ ] 7. Close position block (conditional): click Close on first open position, confirm dialog, click "Close now", verify tab CLOSED
- [ ] 8. Stop agent block: click config card → AgentDetailModal → Stop Agent → verify "Stopped" badge
- [ ] 9. Run `pnpm playwright test e2e/agent-flow.spec.ts` and verify all tests pass

## Notes

- Use `test.use({ storageState: { cookies: [], origins: [] } })` to bypass shared auth
- `admin@crypto.com` has no seed config — must create one via the UI
- Use `page.waitForResponse` / `page.waitForURL` for async operations
- Tests are independent within the spec; use `test.beforeAll` for login only in auth-dependent blocks
