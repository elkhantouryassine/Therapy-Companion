# Stillpoint Therapy Companion

A self-contained therapy companion web app for private accounts, check-ins, journaling, grounding, reframing, breathing, daily reset planning, and safety planning.

Open `index.html` in a browser, or run `node dev-server.js` and visit the local URL it prints. If `4173` is already busy, the app can run on another port such as `http://127.0.0.1:4174/`.

Accounts and entries are stored in a browser IndexedDB database. Passwords are hashed locally with browser crypto before being saved. There is no remote backend or cloud account.

Database stores:

- `users`
- `session`
- `moods`
- `journals`
- `reframes`
- `bodyNotes`
- `safetyPlan`
- `resetPlans`
- `preferences`

For immediate danger, use local emergency services or a trusted local help contact.
