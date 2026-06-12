# PRD — Shree Gopaldas Vallabhdas Jewellers · B2B Hisab

## Problem Statement
Create a two-user web software application for B2B jewellery store accounting with Gold, Jama, Naame, Fine Gold, Amount, Item Name, Date — proper date-wise tracking so both users can make entries and the Hisab matches. For Shree Gopaldas Vallabhdas Jewellers.

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT auth (httpOnly cookies + Bearer fallback), bcrypt hashing
- Frontend: React 19 + react-router + Tailwind + shadcn/ui + sonner toasts + lucide icons
- Excel export via openpyxl

## User Personas
- **Admin (owner)**: full access, manage users (activate/deactivate, role), delete parties/entries
- **User (employee/partner)**: add/edit own entries, add parties, view all reports

## Core Requirements
- Full registration/login system with admin role
- Party master with per-party Hisab/balance
- Entry fields: Date, Party, Item, Type (Jama/Naame), Gold (g), Fine Gold (g), Silver (g), Touch %, Amount (₹), Remarks
- Reports: Daily Hisab summary (with user-wise breakdown), Party-wise balance statement, Date range filter + Excel export
- Bilingual labels: English + Hindi (Devanagari)

## Implemented (2026-02-15)
- JWT auth (register/login/logout/me) with seeded admin (admin@gopaldas.com / Admin@123)
- Parties CRUD (admin can delete, only if no linked entries)
- Entries CRUD with party linking, type filtering, date range filtering
- Dashboard with today's Jama/Naame totals (Gold/Fine/Silver/Amount), net balance, by-user breakdown, today's entries table
- Entries ledger with filters (date range, party, type) + footer totals
- Party master with running balance per party
- Party ledger page with running balance row-by-row
- Reports page: daily report tabs (date selector, user-wise comparison), party balances tab, export tab
- Excel export with totals (Jama, Naame, Balance rows)
- Admin user management (toggle active, change role)
- Beautiful traditional Bahi-Khata aesthetic with gold accents, Fraunces serif headings, IBM Plex Sans body, Noto Devanagari for Hindi

## P0 / Next
- PDF export (currently Excel only)
- Print-friendly view of party ledger
- Search/autocomplete for parties
- Backup/restore data

## P1 / Future
- Multi-shop support
- SMS/WhatsApp notifications to parties
- Rate-based fine gold auto-calculation
- Mobile-responsive optimizations

## Credentials
- Admin: admin@gopaldas.com / Admin@123
