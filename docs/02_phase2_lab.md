# Phase 2 — Lab module (source: `T_Lab`)

## Kept exactly as in the source
- These tables are kept with the same columns, constraints and computed amounts: `test_master`, `test_components`, `test_fees`, `test_assignments`, `assignment_tests`, `patient_results`, `result_values`, `lab_settings`.
- **Reference ranges:** male, female and general ranges are copied onto each result value when it is saved, exactly as before.
- **Fees:** fee, discount and net amounts, the fee sync, and assignment totals.
- **Numbering:** assignments are numbered `LA000001` and patient codes `P000001`.
- **Status rules:** the Pending → Sample Collected → In Progress → Completed roll-up.
- **Screens:** Lab Dashboard, Patients (with Excel import/export), Assign Tests, Assignment List, Result Entry, printed Report, Test Master (with import), Test Fee Master, Lab Settings.

## What changes
| Source | Merged app |
|---|---|
| `patients` table | Shared `Patient` table. Lab reads it through the view `lab_patients`, which uses the old snake_case column names, so the lab queries stay the same. Inserts and updates go to `Patient`. |
| `app_users` table + Lab Users screen + lab login | Core `AppUser`, the core login and the core User Master. `created_by` and `entered_by` now reference `AppUser(UserId)`. |
| Roles Attendant / Assistant | Menu Access, checked on the **server** (see the table below). |
| `/api/...` | `/api/lab/...`; the lab pages call it through their own axios client. |
| Change password (lab only) | Moved to core, so every login can change its own password from the user menu. |
| Deactivated user still works until token expiry? | Core now re-reads the user on every request, as Lab did. A switched-off login stops working at once. |

### Permission mapping
| Lab permission | Source roles | Merged rule |
|---|---|---|
| Add or edit patients, import patients | Admin, Attendant | Admin, or **Full** on `lab.patients` |
| Add or edit assignments, change test status | Admin, Attendant | Admin, or **Full** on `lab.assignment-new` |
| Enter results | Admin, Assistant | Admin, or **Full** on `lab.results` |
| Tests, fees, lab settings, all deletes | Admin | Admin |
| Read screens | any login | any login (as in the source) |

## Shared patient notes
- A patient created in Lab (or later in Clinic) is one row in `Patient`, visible to both modules.
- A patient without a code (from Clinic) gets the next `P000001`-style code the first time Lab saves it.
- A patient who has lab assignments cannot be deleted, as in the source. Phase 4 adds the same check for clinic history.

## Menu (`lab.*` keys)
Lab ▸ Lab Dashboard, Patients, Result Entry, Lab Settings | Assignment (Assign Tests, Assignment List) | Masters (Test Master, Test Fee Master)

## Result (2026-11-12)
- `npm run smoke`: core smoke test 27/27, lab checks 55/55 (adapted from T_Lab scripts/checks.js).
- UI flow checked in the browser: test, then patient, then assignment, then results, then printed report (female range used).

## Change 2026-11-12 (user request)
- **Removed** the Lab ▸ Patients page from the menu and routes. Patients are registered once, in Clinic ▸ Registration ▸ Patient, and Lab uses the same shared list: Assign Tests and Result Entry search it.
- Lab Dashboard "+ Patient" now opens Clinic ▸ Registration ▸ Patient. It is shown to Admin and to logins with Full access on that clinic page.
- The Lab patient API is kept, because Assign Tests and Result Entry search through it.
