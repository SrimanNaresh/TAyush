# Phase 3 — Pharmacy module (source: `Pharmacy/Ayush_Pharmacy`)

## Decision used
Open question 1 from the merge plan was not answered, so the plan's proposal is used: **Ayush_Pharmacy is the only pharmacy module**. The Clinic's own pharmacy pages (Demo Source) are not ported in Phase 4. This can still be changed before Phase 4.

## Kept exactly as in the source
- **Tables:** every pharmacy table, column, constraint and index is kept: masters, `PharmacyItem`, `Vendor`, PO, Stock In, Stock Return, Vendor Payment, Sales Billing, Sales Return, Stock Adjustment.
- **Seed values:** the unit, potency and category pick-lists.
- **Calculations:** GST and rates (`purchaseCalc.js`), batch / FIFO stock (`batchStock.js`), stock events, and every report.
- **Document numbers:** `<CODE>-<PREFIX>0001`, built from the row id (`docNumber.js`). The code comes from `CLINIC_CODE` in `.env`; the source default is `AP`. This app uses **`TA`**, the same code the old tayush suite used.
- **Admin-only actions:** all Admin-only actions stay Admin-only (deletes, item import, Stock In edit).
- **Screens:** all pharmacy screens and their URLs (`/pharmacy/...`). Menu keys are unchanged (`pharmacy.*`).

## What changes
| Source | Merged app |
|---|---|
| `/api/vendors`, `/api/stock-ins`, … | `/api/pharmacy/vendors`, … The pages call these through their own axios client. |
| `AppUser`, `MenuAccess`, `ClinicDetails`, the Pharmacy login and users | Core |
| Pharmacy Details page | Core **Organisation Details** (same fields). Receipts print from it. |
| Pharmacy Dashboard at `/dashboard` | `/pharmacy` (menu key `pharmacy.dashboard`). `/dashboard` is now the suite home. |
| Any signed-in login could save pharmacy documents | Saving needs Admin or **Full** Menu Access on a matching page, checked on the server (see below). Reading stays open to any login, as in the source. |

### Write permission (POST / PUT / DELETE)
| API | Allowed Menu Access (Full) |
|---|---|
| vendors | Vendor Master, Purchase Order, Three in One (IPS) |
| item-master | Item Master, Bulk Update, Purchase Order, Stock In, Three in One (IPS) |
| purchase-orders | Purchase Order, Three in One (IPS) |
| stock-ins | Stock In, Three in One (IPS) |
| vendor-bill-payments | Vendor Payments |
| stock-returns | Purchase Return |
| stock-adjustments | Stock Adjustment |
| sales-billings | Sales Billing |
| sales-returns | Sales Return |

## Not linked yet
Pharmacy sales still record the customer as name + mobile, exactly as in the source. Linking a sale to the shared `Patient` comes with the Phase 5 cross-module links (prescription → pharmacy bill).

## Result (2026-11-12)
- `npm run smoke` runs three suites: core 27/27, lab 55/55, pharmacy 30/30.
- UI flow checked in the browser: new item (ITM000001), Stock Adjustment +10 (TA-ADJ0001), sale of 1 (TA-S0001, Rs 100). The stock report showed 9 left.
- Test rows were removed and the id counters reset with `backend/scripts/resetTestData.sql`, so the first real documents start at 0001. Only use that script while the database holds no real data.
