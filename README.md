# Passion Campus — First Service Management (FLCPC Members CMS)

A simple **member & attendance management system** built with **Google Apps
Script**, designed to sit directly on top of a Google Sheet containing the
membership data (`MEMBERS`) and attendance records (`ATTENDANCE`).

## What it does

- ➕ **Add & update members** (no delete — use status instead)
- ✅ **Record / update / delete attendance** with a fast, tap-to-mark checklist
- 📅 **Service report**: count + percentage present/absent for any date, plus
  the actual list of who was present and who was absent
- 📈 **Trends**: bar graph of present count across a year, filterable by month
  and service type
- 🔎 **Member history**: every service a person attended, filterable by year,
  month and exact date
- 📊 **Dashboard** with key stats and recent services

## Where the code is

Everything lives in [`apps-script/`](./apps-script). See
[`apps-script/README.md`](./apps-script/README.md) for full setup and
deployment instructions (paste-in or `clasp`).

## Quick start

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Copy the files from `apps-script/` into the Apps Script project (matching
   names; `.html` files as HTML files; paste `appsscript.json` into project
   settings).
3. Reload the sheet → use the **📋 Members CMS** menu → **Open Dashboard**.
