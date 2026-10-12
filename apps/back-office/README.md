# Back-office

The back-office of Wanderlore, for game masters: worlds, scenarios and their
catalogues (roadmap, Phase 5). Same stack and conventions as the player front
(`apps/frontend`) — see `CLAUDE.md`.

```bash
npm run dev        # http://localhost:5174, the API proxied to the backend
npm run test
npm run lint
npm run typecheck
```

Sign in with a `game_master` account (`gm@wanderlore.test` / `password` once the
seeders ran). A player is turned away: the backend refuses them on every
`/api/v1/admin` route regardless.

`src/api/client.ts` is a copy of the player front's client: keep the two in step.
