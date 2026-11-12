# Phase 1 — Core (approved 2026-11-12)

## Base
- **Frontend shell:** copied from `Pharmacy/Ayush_Pharmacy/frontend`. It is the most polished of the three: nested top/side menu, phone menu, tones, `ui.jsx`, PWA.
- **Backend core:** copied from `Demo Source` and `Ayush_Pharmacy`. Both use the same code for pool, jwt, scrypt passwords and MenuAccess.

## API layout
| Path | Purpose |
|---|---|
| `/api/health`, `/api/app-info`, `/api/manifest.webmanifest` | Public |
| `/api/auth/login`, `/api/auth/me` | Sign-in |
| `/api/core/users` | User Master (Admin only) |
| `/api/core/menu-access` | Menu Access |
| `/api/core/organisation` | Organisation details (name, address, logo, app name) |
| `/api/clinic/*`, `/api/pharmacy/*`, `/api/lab/*` | Added in later phases. Each frontend module gets its own axios client with that `baseURL`, so the copied pages keep their short paths (`/vendors`, …) |

## Core tables in T_AyushNew
- **`AppUser`:** UserId, Username, FullName, PasswordHash, Role, IsActive, LinkedPatientId, CreatedAt
  - Roles: Admin, Doctor, Reception, Pharmacist, Lab, Staff, Patient
- **`MenuAccess`:** UserId + MenuKey → Full / View / No Access. Keys are `clinic.*`, `pharmacy.*`, `lab.*`, `settings.*`
- **`ClinicDetails`** (one row, Id 1): the union of the Clinic and Pharmacy columns. The Clinic letter-pad columns come in Phase 4.
- **`Patient`:** the union of the Clinic `Patient` and Lab `patients` columns: PatientId, PatientCode, Name, Gender, DateOfBirth, Age, MobileNo, Email, Address, ReferredBy, RegistrationDate, IsActive, CreatedAt, UpdatedAt. Patient screens and routes come with Lab (Phase 2) and Clinic (Phase 4).

## Menu
Dashboard | Clinic ▸ | Pharmacy ▸ | Lab ▸ | Settings (Organisation Details, User Master, Menu Access).
In Phase 1 the module menus are empty placeholders.

## Seed
- One `Admin` user. The initial password is read from `ADMIN_INITIAL_PASSWORD` in `backend/.env`; it is never written in code.

## Ports
- Local: API 5160, Vite 5173 (proxy `/api` → 5160)
- Server: API 5160, behind nginx (Phase 6)
