# Phase 5 — Cross-module links

The modules stay independent, and no billing, stock or lab logic changes. A link only **pre-fills** the receiving screen. The user then checks it and saves with that screen's normal Save, so every existing rule still applies: stock, batch, MRP, below-cost, fee master and permissions.

## 1. Prescription → Pharmacy bill
- **Where:** Clinic ▸ Consultation ▸ Prescription Preview gets a **Pharmacy Bill** button for the prescription on screen.
- **What it opens:** Pharmacy ▸ Sales with `?prescription=<id>`, pre-filled with:
  - the customer name and mobile from the patient
  - one line per prescribed medicine that matches a Pharmacy item by name (not case-sensitive, spaces trimmed), each set to quantity 1 with the earliest-expiring batch, exactly as when the item is picked by hand
- **Medicines with no matching Pharmacy item** are listed in a message so the user can add them by hand. The clinic Medication master and the Pharmacy Item master stay separate, as in the sources.

## 2. Prescription → Lab assignment
- **Where:** the same screen gets a **Lab Tests** button when the prescription has lab tests.
- **What it opens:** Lab ▸ Assign Tests with `?prescription=<id>`, with the patient selected (the shared patient record) and the prescribed tests ticked where the name matches a Lab Test Master entry.
- **Unmatched test names** are listed in a message.
- **Prices:** come from the Lab fee master as usual, when the assignment is saved.

## Server
- **New read-only API:** `GET /api/links/prescription/:id`, open to any staff login (a Patient login is blocked). It returns:
  - the prescription, patient, medicines and lab tests
  - for each medicine its matching Pharmacy item, or null
  - for each lab test its matching Lab test, or null
- **Nothing is written** by the link itself.

## Advice for the masters
To get full matches, use the same names in Clinic Medication and Pharmacy Item, and in Clinic Test Master and Lab Test Master.

## Result (2026-11-12)
- `npm run smoke` runs five suites: core 27, lab 55, pharmacy 30, clinic 47, links 12. All pass.
- Checked in the browser with a prescription for "Arnica Montana 30" + "Calendula Q" and the lab test "Blood Sugar":
  - **Pharmacy Bill** opened Sales with the patient name and mobile filled in, and Arnica on batch B7 (stock 20) at Rs 120. It flagged "Calendula Q" as not in Pharmacy items. The bill saved as TA-S0001.
  - **Lab Tests** opened Assign Tests with the shared patient (P000001), Blood Sugar ticked and the note "From prescription #2". It saved as LA000001.
- The demo data was removed and the counters reset.
