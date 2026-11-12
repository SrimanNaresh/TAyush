# Ayush ALL IN ONE

Clinic + Pharmacy + Lab in one app, using one database (`T_AyushNew`).
Plans are in `docs/`.

## Warning: one shared database
`backend/.env` points at **T_AyushNew**, the live database for tayush.thangaminfotech.com.
Anything saved while running locally is live data. Do **not** run `npm run smoke` or
`scripts/resetTestData.sql` against it now that the site is live. The check scripts create
and delete records, and pharmacy document numbers come from row ids.

## Run locally
1. Create the backend config: copy `backend/.env.example` to `backend/.env` and fill in the values.
2. Install and prepare the backend:
   ```
   cd backend
   npm ci
   npm run init-db
   ```
   `init-db` creates or upgrades the tables and is safe to run again.
3. Start the API: `npm start` (in `backend`). It listens on port 5160.
4. Run the smoke test: `npm run smoke` (in `backend`).
5. Start the web app:
   ```
   cd frontend
   npm ci
   npm run dev
   ```
   Then open http://localhost:5174. Vite proxies `/api` to port 5160.

The first login is `Admin`. Its initial password is `ADMIN_INITIAL_PASSWORD` in `backend/.env`.

## Layout
- `backend/src/core`: login, users, menu access, organisation details
- `backend/src/{clinic,pharmacy,lab}`: one folder per module, served at `/api/<module>/*`
- `backend/src/db/schema`: table scripts, one per module
- `frontend/src/modules/{clinic,pharmacy,lab}`: each module's `menu.js`, `routes.jsx`, pages and its own API client
