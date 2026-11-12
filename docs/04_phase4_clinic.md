# Phase 4 — Clinic module (source: `Demo Source`)

## Decisions used (the open questions were not answered, so the earlier suite's choices are kept)
- **Pharmacy:** only the Ayush_Pharmacy module from Phase 3. The Demo Source pharmacy pages and tables (Supplier, Item, Purchase Invoice/Return, Sales Billing/Return, Stock) are **not** ported.
- **Patient Records:** kept, with Cloudinary upload and download, plus the **Patient portal** login. They work once the `CLOUDINARY_*` keys are set in `backend/.env`; without the keys the screens say storage is not set up.
- **Not ported:**
  - Mail Config, Google Drive config and OAuth: they had no clinic screen, and the earlier suite skipped them too.
  - **DB Details**: that page rewrote the server's database connection from the browser, which is unsafe in a shared app.

## Kept exactly as in the source
- **Tables:** Medication, LabTest, Employee + EmployeeShift, VitalSign, Prescription + items + lab tests, PatientConfirmation (token and status), PatientBill, PatientDocument. Their columns, cascades and soft deletes are unchanged.
- **Logic:**
  - Patient queue: confirm → vitals → doctor → billing
  - Prescriptions and next-visit dates
  - Billing rates (`billingRate.js`)
  - Reports, letter-pad prescription printing, PDF and Excel export
- **Dashboards:** the Admin, Reception and Doctor dashboards.

## What changes
| Source | Merged app |
|---|---|
| `Patient` table (Name, MobileNo, Address, Age) | Shared `Patient` table. It has the same columns, so the clinic queries are unchanged. New clinic patients also get the next `P000001` code so that Lab shows them with an ID. |
| `/api/...` | `/api/clinic/...`; the pages use their own axios client |
| Page URLs `/master/...`, `/confirm/...`, … | `/clinic/master/...`, `/clinic/confirm/...`, … |
| Menu keys `confirm.prescription`, … | `clinic.confirm.prescription`, … |
| Clinic Master (`ClinicDetails`) | Same row as Organisation Details. The clinic print fields are added as columns: page size, letter pad, map. The "delete clinic details" action is removed, because the row is shared. |
| Users / Menu Access / login | Core. The **Patient** role is added to User Master, with a linked-patient picker. |
| Saving was open to any login | Saving needs Admin or **Full** access on a matching clinic page, checked on the server (below). Reading stays open to staff. |
| A Patient login could call any API (only the screen was locked) | A Patient login is blocked on the server from everything except its own records, sign-in and the organisation name. |
| Lab Patients list | Lab hides patients that Clinic deleted (clinic deletes are soft). Their old lab assignments still open. |

### Write permission (POST / PUT / DELETE), Full access on any of
| API | Clinic pages |
|---|---|
| medications | Medication, Medication List |
| lab-tests | Test Master (clinic) |
| employees | Employee, Employee List |
| patients | Patient, Patient List |
| confirmations | Confirm & Search, Confirm List, Patient, Doctor's |
| vitals | Vital Sign, Vital Sign List |
| prescriptions | Doctor's, Prescription Preview, Follow Up Patients |
| billing | Patient Bill |
| clinic-details | Clinic Master (letter pad: Prescription for Your Letter Pad) |
| patient-documents | source roles: Admin, Doctor and Reception upload; Admin and Doctor delete; a Patient views only their own records |

## For Phase 5 (links)
- Clinic "Lab" tests in a prescription are the clinic's own `LabTest` names, as in the source. Phase 5 adds the link from a prescription to a Lab assignment.
- Prescription → Pharmacy Sales Billing (prefill the medicines).

## Result (2026-11-12)
- `npm run smoke` runs four suites: core 27/27, lab 55/55, pharmacy 30/30, clinic 47/47. The clinic suite covers the full visit (register, confirm, vitals, examine, prescription, bill, Completed), the clinic patient appearing in Lab with a P-code, server-side access rules, the Patient-login lock and the shared Clinic Master / Organisation row.
- Checked in the browser: Admin Dashboard, Patient registration, Confirm & Search (confirmed for today), Vital Sign, Doctor's, Clinic Master, Letter Pad, Patient Bill, the Clinic mega-menu, and the Patient portal login (My Records only).
- Patient Records upload has not been tested end to end: it needs the CLOUDINARY_* keys in `backend/.env`.
- Test rows were removed and the counters reset (`backend/scripts/resetTestData.sql`, which now also covers the clinic tables).
