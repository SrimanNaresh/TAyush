# Phase 6 — Deploy and tayush cut-over

## Target
| | |
|---|---|
| Server | 156.67.104.242 (Node 24 + PM2 already installed) |
| Path | `/opt/projects/ayushallinone` |
| API | PM2 process `ayushallinone`, port **5160** |
| Web | nginx serves `frontend/dist`; `/api` → 127.0.0.1:5160 |
| Site | `ayushallinone-tayush.conf` for **tayush.thangaminfotech.com** (wildcard cert) |
| DB | `T_AyushNew` on 147.93.155.21 |

## Steps (`scripts/deploy.py`)
1. `status`: read-only look at PM2, the ports and the nginx sites.
2. `deploy`:
   - Build the frontend, upload the backend, the dist and the deploy files.
   - Run `npm ci` and `init-db`.
   - Start PM2 on port 5160, then run a health check.
   - The server's `backend/.env` is created only on the first deploy and kept after that. That is where the Cloudinary keys go.
   - Until cut-over, tayush keeps serving the old suite.
3. `cutover`:
   - Back up the old nginx site (`thangamsuite-tayush.conf`) into `/root/backups/ayushallinone-cutover/<time>`.
   - Disable the old site, enable the new one, run `nginx -t`, then reload.
   - Stop the old PM2 process `thangamsuite`. It is stopped, not deleted.
   - The old databases `T_Ayush` and `ThangamMaster` are not touched.
4. `rollback`: restore the old site and start `thangamsuite` again.
5. After cut-over: update `PORT_REGISTRY.md` and run the smoke checks against the live server.

## Old suite data (T_Ayush, checked 2026-11-12)
Masters entered on tayush:
- 845 pharmacy items, 57 categories, 26 manufacturers, 14 units, 6 potencies, 5 vendors
- 55 lab tests with 121 components and 55 fees
- 3 users

Transactions: only 1 test patient/visit, no sales.

The new database starts empty unless these masters are copied over (see the open decision).

## Result (2026-11-12)
- `deploy` OK, then `golive` OK: https://tayush.thangaminfotech.com serves Ayush All In One (health 200, app-info "Ayush All In One").
- The API listens on 127.0.0.1:5160 only; port 5160 is closed from the internet.
- Old suite: nginx site `thangamsuite-tayush.conf` disabled and backed up in `/root/backups/ayushallinone-cutover/20261112-183334`; PM2 `thangamsuite` stopped (not deleted). Rollback: `python scripts/deploy.py rollback`.
- PORT_REGISTRY.md updated.
- Still to do by the owner: change the Admin password after the first sign-in, and add the CLOUDINARY_* keys to `/opt/projects/ayushallinone/backend/.env`, then run `pm2 restart ayushallinone`.
