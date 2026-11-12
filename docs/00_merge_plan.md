# Ayush ALL IN ONE — Merge Plan (draft, waiting for OK)

Date: 2026-11-12

## Decisions already taken
| Topic | Decision |
|---|---|
| Sources | Clinic = `Demo Source`, Pharmacy = `Pharmacy/Ayush_Pharmacy`, Lab = `T_Lab` |
| Old sources | **Read-only.** Code is copied into this folder; nothing in the old folders, servers, DBs or subdomains changes |
| Tenancy | Single client, one database **`T_AyushNew`** (on 147.93.155.21, currently 0 tables) |
| Data | Empty schema + masters/seed only. No copy from T_AyushDemo / T_Pharmacy / T_lap |
| Old suite (tayush, PM2 `thangamsuite`, T_Ayush + ThangamMaster) | Keeps running until Phase 6. The new app then takes over **`tayush.thangaminfotech.com`**, and the old suite is stopped (kept for rollback) |

## What the three apps have in common
All three use the same stack: Node + Express + `mssql` for the backend, and React 18 + Vite + Tailwind for the frontend. Merging is therefore a move of code into one app, with no rewrite.

## Target layout
```
ALL IN ONE/
  backend/   one Express server, one DB pool (T_AyushNew)
    src/core/      auth, users, menu access, organisation details, patients
    src/clinic/    routes from Demo Source
    src/pharmacy/  routes from Ayush_Pharmacy
    src/lab/       routes from T_Lab
    src/db/initDb  core + clinic + pharmacy + lab tables, run in order
  frontend/  one React app: one login, one top menu, module sections
    src/modules/clinic | pharmacy | lab
  deploy/    nginx site, PM2 or docker config
  docs/
```
- API paths: `/api/auth`, `/api/core/*`, `/api/clinic/*`, `/api/pharmacy/*`, `/api/lab/*`
- UI paths: `/clinic/...`, `/pharmacy/...`, `/lab/...`
- Menu Access: one screen that controls access to every page in every module

## Table clashes and how they are resolved
| Clash | Resolution |
|---|---|
| `AppUser` (Clinic + Pharmacy) and `app_users` (Lab) | One shared `AppUser` table with a role and per-page menu access |
| `ClinicDetails` (Clinic + Pharmacy) and `lab_settings` | One organisation record. Clinic letterhead, pharmacy GSTIN/DL and lab report header stay as separate settings |
| `Patient` (Clinic) and `patients` (Lab) | One shared `Patient` master. Lab assignments link to it |
| `MenuAccess` (Clinic + Pharmacy) | One table, keyed by module + page |
| Pharmacy tables in **both** Clinic and Pharmacy (`PharmacyItem`, `SalesBilling`, `SalesReturn`, `GenericNameMaster`, `ManufacturerMaster`, `UnitMaster`) | **Proposal:** the Pharmacy app's version is used, because it is richer (PO, Stock In, batch stock, vendor payments, stock adjustment). The Clinic's own pharmacy pages (Item, Purchase Invoice/Return, Sales Billing, Stock, Supplier) are **not** carried over |
| Lab tables (`test_master`, `test_assignments`, …) | No clash. Kept as they are |

Clinic links that will be added:
- A prescription can be sent to Pharmacy Sales Billing (the medicines are prefilled).
- Lab tests ordered in a prescription create a Lab assignment.

## Rules kept
- Billing, GST, stock (batch/FIFO) and lab reference-range logic are copied **exactly**. Only import paths and table/column names change.
- Secrets (DB password, JWT, Cloudinary, mail) live only in `backend/.env`, which is git-ignored. They never go into code or docs.

## Phases (each one is tested before the next starts)
1. **Core**: project skeleton, `.env`, DB pool, `initDb` core tables, login, users, menu access, shell and menu
2. **Lab**: the smallest module, which proves the module pattern
3. **Pharmacy**
4. **Clinic** (patients, vitals, prescriptions, confirmations, reports, billing, patient documents)
5. **Cross-module links**: Prescription → Pharmacy bill and Prescription → Lab assignment
6. **Local test, then deploy** on port 5160 and cut tayush over to the new app (see Deployment)

## Deployment
- Subdomain: **`tayush.thangaminfotech.com`** (decided 2026-11-12)
- Server: 156.67.104.242, path `/opt/projects/ayushallinone`, backend port **5160**. The old suite keeps 5150, so the two never run on the same port.
- Until Phase 6, all testing is local. tayush keeps serving the old suite.
- **Phase 6 cut-over:**
  1. Back up the nginx site `thangamsuite-tayush.conf`.
  2. Point tayush at the new app (port 5160).
  3. Stop the old PM2 process `thangamsuite`. It is stopped, not deleted.
  4. Leave the old DBs T_Ayush and ThangamMaster untouched.
- **Rollback:** restore the backed-up nginx site and start `thangamsuite` again.
- Update the tayush row in `PORT_REGISTRY.md` at cut-over.

## Open questions
1. Is it OK to drop the Clinic's built-in pharmacy pages and use the Pharmacy app only?
2. Is port 5160 OK?
3. Keep Patient Records (Cloudinary upload, patient portal) and Mail/Google Drive config from the Clinic? (These were skipped in the old suite.)
