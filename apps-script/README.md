# FLCPC Members CMS — Google Apps Script

A lightweight **member & attendance management system** that sits directly on
top of a Google Sheet. It is built entirely with Google Apps Script (backend
`.gs` files) and HTML Service (the UI), so there is nothing to host — it lives
inside your spreadsheet.

It was modelled on the sample workbook which had two tabs:

| Sheet        | Columns                |
|--------------|------------------------|
| `MEMBERS`    | NAME, CONTACT, RESIDENCE |
| `ATTENDANCE` | NAME, SERVICE DATE     |

The app keeps those two tabs as the source of truth (extending them with a few
helpful columns) and adds a friendly dashboard on top.

---

## ✨ Features

| Requirement | Where it lives |
|---|---|
| **Add & update members** (no delete) | *Members* tab — add/edit modal. Deletion is intentionally not exposed. |
| **Enter, update & delete attendance** | *Record Attendance* tab (bulk) + per-record/whole-service delete. |
| **Easy, friendly attendance recording** | Pick a date → a checklist of every member appears. Tap to mark present, "select all / clear all", live present counter, then **Save**. Re-saving the same date updates the record (adds new, removes unchecked). |
| **# and % present / absent for a date** | *Service Report* tab — summary pills + present-rate progress bar. |
| **Actual people present / absent for a date** | *Service Report* tab — two columns listing the real members in each group. |
| **Bar graph of present count across a year (filter by month)** | *Trends* tab — Google column chart. Whole-year view = one bar per month; pick a month = one bar per service day. Also filterable by service type. |
| **A person's attended services (filter year / month / day)** | *Member History* tab — pick a member and optional year, month, and/or exact date. |
| **Extra CMS goodies** | Dashboard KPIs (totals, active members, avg. recent attendance), recent-services table, member status (Active/Inactive/Visitor), gender, date joined, notes, search everywhere, service types, multi-service days, name-change sync into attendance, sample-data loader. |
| **Mobile-first, modern UI** | Phone-native design that scales up to desktop: a **bottom tab bar** (becomes a left rail ≥900px), a context **floating action button** (add member / walk-in), **bottom-sheet** forms, a sticky **Save attendance** bar, card-based member list, skeleton loaders, a slim top progress bar and large tap targets. The chart redraws on rotation. Use the **web-app deployment** on phones (not the in-Sheets dialog). |

---

## 📁 Files

```
appsscript.json   App manifest (timezone, scopes, web-app config)
Config.gs         Sheet/column names, shared date & id helpers
Setup.gs          Menu, dialog/web-app entry points, sheet creation + legacy migration
Members.gs        Member read / add / update API
Attendance.gs     Attendance read / bulk-save / add / delete API
Reports.gs        Per-date summary, yearly chart data, member history, dashboard stats
Bridge.gs         Single whitelisted dispatcher the UI calls
Index.html        App shell (sidebar + views + member modal)
Stylesheet.html   All CSS
JavaScript.html   Front-end controller (talks to backend via google.script.run)
```

---

## 🚀 Setup — Option A: paste into the Sheet (quickest)

1. Open your Google Sheet (or make a new one and add tabs named `MEMBERS` and
   `ATTENDANCE`, or just let the app create them).
2. **Extensions → Apps Script**.
3. For each `.gs` file here, create a matching script file and paste its
   contents. For each `.html` file, **File → New → HTML file** with the **same
   name** (`Index`, `Stylesheet`, `JavaScript`) and paste.
4. Open the manifest: ⚙️ **Project Settings → "Show appsscript.json"**, then
   paste in `appsscript.json`.
5. **Save**, reload the spreadsheet. A **📋 Members CMS** menu appears.
6. Click **📋 Members CMS → Open Dashboard** (approve the permission prompt the
   first time). Done.

> Tip: **📋 Members CMS → Setup / Repair Sheets** (re)creates the tabs and
> headers safely without deleting data, and migrates a legacy sample sheet to
> the new schema.

## 🚀 Setup — Option B: clasp (version-controlled)

```bash
npm install -g @google/clasp
clasp login
# Bound to an existing sheet:
clasp create --type sheets --title "FLCPC Members CMS"  # or: clasp clone <scriptId>
clasp push
```
Then reload the sheet and use the **📋 Members CMS** menu.

### Optional: deploy as a standalone web app
**Deploy → New deployment → Web app** (Execute as *me*, access as you prefer).
The web app uses the same UI. The script remembers the spreadsheet id, so
`doGet` works without the menu.

---

## 🗂 Data model (after setup)

`MEMBERS`: `MEMBER_ID, NAME, CONTACT, RESIDENCE, GENDER, DATE_JOINED, STATUS, NOTES`

`ATTENDANCE`: `ATT_ID, MEMBER_ID, NAME, SERVICE_DATE, SERVICE_TYPE, RECORDED_AT`

`SERVICES` (auto): `SERVICE_DATE, SERVICE_TYPE, TITLE, NOTES`
`SETTINGS` (auto): `KEY, VALUE`

`SERVICE_DATE` is stored as a `yyyy-MM-dd` string in the sheet's timezone
(`Africa/Accra` by default — change it in `appsscript.json`). You can still type
into the sheet directly; the app reads whatever is there.

---

## 🔌 Loading the sample data

Run `loadSampleData` once (from the Apps Script editor, or call it via the
dispatcher) to populate the four sample members for a quick demo.

---

## 🔒 Notes

- **No member deletion** by design — edit `STATUS` to *Inactive* instead.
- Bulk save is wrapped in a `LockService` lock so two people recording the same
  service won't clobber each other.
- Scopes are minimal: `spreadsheets.currentonly` + `container.ui`.
