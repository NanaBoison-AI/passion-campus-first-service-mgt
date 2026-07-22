# Area 4 · Membership & Attendance

A mobile-first, minimalist web app to manage **church group memberships** and
**attendance** for the groups under *Area 4*.

- **Membership + group data** lives in **Google Sheets** (easy for an admin to
  upload/edit) — exposed to the app via a tiny **Apps Script JSON API**.
- **Attendance data** lives in **Firebase Firestore** (easy to review & update).
- The **frontend** is a static **Vite** app hosted on **Cloudflare Pages**, with
  a Cloudflare **Pages Function** proxying the Sheets API (so there's no CORS and
  the Apps Script URL stays server-side).

```
 Browser (Cloudflare Pages, Vite SPA)
   ├── /api/sheets  ──►  Pages Function  ──►  Apps Script Web App  ──►  Google Sheets
   │                                                                   (GROUPS, MEMBERS)
   └── Firebase JS SDK  ──►  Firestore  (groups/{id}/attendance/{date})
```

## User flow

1. Open the app → **list of groups** under Area 4 (from the Sheet).
2. Tap a group → **group dashboard** with four actions:
   - **Memberships** — create & update members (no delete).
   - **Record** — pick a date, tap a checklist of members, save.
   - **Review** — present/absent counts, %, the actual people, and **CSV export**
     (single date *or* a date range).
   - **Graphs** — total attendance per day for a date range; average monthly
     attendance for a given year.

---

## Project layout

```
area4-attendance/
├── index.html
├── vite.config.js            # dev proxy /api/sheets → Apps Script
├── .env.example              # copy to .env for local dev
├── firestore.rules           # Firestore security rules (open + recommended)
├── public/
│   ├── favicon.svg
│   └── _redirects            # SPA fallback for Cloudflare Pages
├── functions/api/sheets.js   # Cloudflare Pages Function (Sheets proxy)
├── apps-script/
│   ├── Code.gs               # Sheets JSON API (groups/members read+write)
│   └── appsscript.json
└── src/
    ├── main.js               # shell + hash router
    ├── styles.css            # design system (mobile-first, dark-mode aware)
    ├── api/  (sheets, firebase, attendance)
    ├── lib/  (dom, router, ui, store, format, csv)
    └── views/ (groups, dashboard, members, record, review, graphs)
```

## Data model

**Google Sheet — `GROUPS` tab**

| GROUP_ID | NAME | DESCRIPTION | LEADER | CONTACT | MEETING_DAY |
|----------|------|-------------|--------|---------|-------------|

**Google Sheet — `MEMBERS` tab** (one row per member, `GROUP_ID` links to a group)

| MEMBER_ID | GROUP_ID | NAME | CONTACT | RESIDENCE | GENDER | STATUS | DATE_JOINED | NOTES |
|-----------|----------|------|---------|-----------|--------|--------|-------------|-------|

**Firestore** — `groups/{groupId}/attendance/{yyyy-MM-dd}`
```json
{ "date": "2026-06-14", "present": ["MEM-ab12cd34", "..."], "count": 12, "updatedAt": "..." }
```
`present` holds the member ids marked present; absentees are derived by diffing
against the group's member list.

---

## Setup

### 1. Google Sheet + Apps Script API
1. Create a Google Sheet (this holds groups + members).
2. **Extensions → Apps Script**. Paste `apps-script/Code.gs`, and paste
   `apps-script/appsscript.json` into ⚙️ **Project Settings → Show appsscript.json**.
3. In the editor, run the `setupSheets` function once (creates the `GROUPS` and
   `MEMBERS` tabs with headers + two sample groups). Approve the permission prompt.
4. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access*
   **Anyone**. Copy the **/exec URL** — that's your `SHEETS_API_URL`.
5. Fill in the `GROUPS`/`MEMBERS` tabs with your real data (or manage members
   from the app once it's running).

### 2. Firebase (Firestore)
1. Create a Firebase project → **Build → Firestore Database → Create** (start in
   production mode).
2. **Project settings → Your apps → Web app** → copy the SDK config into the
   `VITE_FIREBASE_*` values.
3. Publish the rules from `firestore.rules` (**Firestore → Rules**). The default
   is **open** for a quick pilot — read *Locking it down* below before real use.

### 3. Local dev
```bash
cd area4-attendance
cp .env.example .env      # fill SHEETS_API_URL + VITE_FIREBASE_*
npm install
npm run dev               # http://localhost:5173  (proxies /api/sheets)
```

### 4. Deploy to Cloudflare Pages
1. Push this repo to GitHub, then in Cloudflare: **Workers & Pages → Create →
   Pages → Connect to Git**.
2. Build settings:
   - **Root directory:** `area4-attendance`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. **Settings → Environment variables** (Production *and* Preview):
   - `SHEETS_API_URL` = your Apps Script `/exec` URL (used by the Pages Function)
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
     `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
     `VITE_FIREBASE_APP_ID`, `VITE_AREA_LABEL`
4. Add your Pages domain to Firebase **Auth → Settings → Authorized domains**
   (needed if/when you enable sign-in).

`functions/api/sheets.js` is picked up automatically by Pages — no extra config.

---

## Locking it down (recommended before real data)

The default Firestore rules allow anyone with the URL to read/write attendance.
To require login:
1. Firebase **Authentication → Sign-in method → Google → Enable**.
2. Add a `allowedUsers/{email}` doc per permitted admin (or adapt the rule).
3. Swap `firestore.rules` for the authenticated block included at the bottom of
   that file, and add a Google sign-in gate in the frontend (Firebase Auth).
Ask and this can be wired in — the app is structured to drop it in.

## Notes & trade-offs
- **No member deletion** by design — set `STATUS` to *Inactive* instead.
- Bundle is ~135 kB gzipped (Firebase + Chart.js dominate); fine for mobile.
- One attendance record per group per date. Multiple services per day can be
  added later by extending the Firestore doc id (e.g. `date_service`).
