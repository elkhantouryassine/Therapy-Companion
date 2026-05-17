# Stillpoint Therapy Companion

A self-contained therapy companion web app for private accounts, check-ins, journaling, grounding, reframing, breathing, local free-talk agent support, and safety planning.

Open `index.html` in a browser, or run `node dev-server.js` and visit `http://127.0.0.1:4173/`.

Accounts and entries are stored in a browser IndexedDB database. Passwords are hashed locally with browser crypto before being saved. There is no remote backend or cloud account.

Database stores:

- `users`
- `session`
- `moods`
- `journals`
- `reframes`
- `bodyNotes`
- `safetyPlan`
- `agentMessages`

The crisis resources shown in the app are U.S.-focused. For immediate danger, use local emergency services.
