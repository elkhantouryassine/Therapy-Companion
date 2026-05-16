# Stillpoint Therapy Companion

A self-contained therapy companion web app for private check-ins, journaling, grounding, reframing, breathing, and safety planning.

Open `index.html` in a browser, or run `node dev-server.js` and visit `http://127.0.0.1:4173/`.

Entries are stored in a browser IndexedDB database with a localStorage fallback for restrictive browser contexts. There is no account or remote backend.

Database stores:

- `moods`
- `journals`
- `reframes`
- `bodyNotes`
- `safetyPlan`
- `agentMessages`

The crisis resources shown in the app are U.S.-focused. For immediate danger, use local emergency services.
