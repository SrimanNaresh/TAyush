# Three in One (IPS) — Draft Mode

## Goal
A bill can be entered partly and kept as a **Draft**. Only when every row is
complete does **Save All** add the items, order and Stock In. That is the point
where the stock shows on the Sales page. A draft never touches Item Master,
orders, stock or selling prices.

## How it works

| Button | When | What it does |
|---|---|---|
| **Save Draft** (new) | Any time. Needs only a Vendor, or a Bill No. Rows can be incomplete or red. | Saves the whole screen (vendor, date, Bill No, vendor details, round off, every row) as one draft. Pressing it again updates the same draft. |
| **Save All** (existing) | Only when every row is complete. The checks stay exactly as today. | Does what it does today (items → order → Stock In), then deletes the draft. The stock appears in Sales Billing. |

- **Drafts list:** a new **Drafts (n)** button in the header opens a list of
  Bill No, Vendor, Date, lines, total and last saved. **Open** loads a draft
  back into the screen, and **Delete** removes it.
- Red rows stay red while you work. A draft can be saved with them. Save All
  stays blocked until they are fixed, the same as today.
- A draft whose Bill No and vendor match another draft or a saved Stock In shows
  a warning, but it can still be saved.

## Changes
1. **Database (live T_AyushNew, adds only):** a new table `IpsDraft`
   (`DraftId`, `VendorId` NULL, `BillNo`, `BillDate`, `Data` NVARCHAR(MAX) JSON
   of the screen, `LineCount`, `NetAmount`, `CreatedBy`, `CreatedAt`,
   `UpdatedAt`). Added in `schema/pharmacy.js` and applied with `npm run init-db`.
2. **API:** `/api/pharmacy/ips-drafts` with list, get, create, update and
   delete, behind the same login and menu access as Three in One.
3. **Screen:** `StockIps.jsx` gets a Save Draft button, a Drafts list, and code
   to load a draft back into the screen and delete it after Save All.

## Not changed
Stock, billing and GST logic, Item Master, Purchase Order, Stock In and Sales
Billing all stay as they are. A draft is only saved screen data.
