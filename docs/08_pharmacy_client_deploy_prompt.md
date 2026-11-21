# Prompt — deploy the Pharmacy module for a new client

Fill in the `<…>` values. Then paste everything below the line into a new Claude
Code session opened on a **copy** of this project folder.

---

Set up and deploy the Ayush All In One app for a new client, with **only the
Pharmacy module** turned on. The source is this project, copied from
`D:\Source File\Client Source\ALL IN ONE` (repo SrimanNaresh/TAyush, branch
`main`). Do not change the original folder, the live tayush site, PM2
`ayushallinone`, port 5160 or the database `T_AyushNew`.

## New client
| | |
|---|---|
| Client / shop name | `<CLIENT NAME>` (app name on the login page and bills) |
| Folder (local) | `D:\Source File\Client Source\<FOLDER>` |
| Subdomain | `<sub>.thangaminfotech.com` (the wildcard cert is already on the server) |
| Server | 156.67.104.242, path `/opt/projects/<slug>` |
| PM2 process | `<slug>` |
| API port | `<PORT>`: take the next free one from `../PORT_REGISTRY.md` and check it with `ss -ltnp` on the server |
| Database | `<DB_NAME>` on 147.93.155.21 (new and empty) |
| Doc code | `CLINIC_CODE=<XX>` (two letters, used in the bill / order / stock in numbers, e.g. XX-SI0001) |
| Plan | `<plan name>`, valid until `<yyyy-mm-dd>`, Menu Rights: **Pharmacy** (plus Reports if they bought it) |

## Steps (show me a short plan first and wait for my OK)
1. **Copy and rename.** Copy the project into the new folder without
   `node_modules`, `dist` or `.git`, and start a new git repo there. Then grep
   the copy for every old identifier and change it for this client: `tayush`,
   `ayushallinone`, `5160`, `T_AyushNew`, `CLINIC_CODE=TA` and
   `Ayush All In One`. Check `scripts/deploy.py`, `deploy/ecosystem.config.cjs`,
   the nginx conf (rename it to `nginx-<sub>.conf`), `.claude/launch.json`,
   `backend/.env*`, the README and the docs.
2. **Simplify `deploy.py`.** This is a fresh site, so there is no old site to
   cut over: drop `cutover` and `rollback`. Keep `status` and `deploy`, and make
   `deploy` enable the new nginx site with `nginx -t` before the reload. Never
   touch another client's nginx site, PM2 process, Docker container or port.
3. **`backend/.env`.** Set `DB_NAME=<DB_NAME>`, `PORT=<PORT>`,
   `CLINIC_CODE=<XX>` and a new strong `JWT_SECRET`. Set
   `ADMIN_INITIAL_PASSWORD`, which I will type. Leave the Cloudinary keys
   empty. Secrets go only in `.env`, never in code or git. Remember that dotenv
   treats `#` in unquoted values as a comment.
4. **Database.** Create `<DB_NAME>` and run `npm run init-db` against it once.
   Also set local dev to point at `<DB_NAME>`, never at `T_AyushNew`.
5. **Pharmacy only.** Do not delete the Clinic or Lab code. Turn them off with
   the plan:
   - Sign in as Super Admin, then set Configuration › Clinic Master ›
     Validity › Menu Rights = Pharmacy (+ Reports). A Super Admin login is
     created with `backend/scripts/setSuperAdmin.js`.
   - Set the app name (Configuration) to `<CLIENT NAME>`.
   - Check that Clinic, Lab and Registration don't show in the menu, and that
     their APIs refuse access for a normal login.
6. **Pharmacy masters.** Start empty. If I give you an item list or vendor
   list (Excel), import it as a separate step with my OK.
7. **Local check.** Run the backend + frontend against `<DB_NAME>` with
   `node scripts/smokeTest.js && node scripts/pharmacyChecks.js` (from `backend/`). Then reset the test data with
   `backend/scripts/resetTestData.sql`, so the client starts at number 0001.
8. **Deploy.** Run `python scripts/deploy.py deploy`. I type the root password
   in a terminal tab; don't use `~/.ssh` keys. Check
   `https://<sub>.thangaminfotech.com` returns 200, then sign in and see that
   only the Pharmacy menu shows.
9. **Afterwards.** Add the port row to `../PORT_REGISTRY.md`, push the new repo
   if I give one, and tell me what's left for me: change the Admin password, and
   add Cloudinary keys if needed.

Rules: plan first and wait for my OK. Never edit `legacy/`. Keep the billing,
GST and stock logic exactly as it is. Explanations can be in Tamil; code and
docs stay in English.
